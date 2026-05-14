const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

function nowIso() {
  return new Date().toISOString();
}

function safeString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value).slice(0, 500);
}

function safeId(value, fallback) {
  const raw = safeString(value, fallback);
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

function normalizeEvent(raw, batchId, req) {
  const eventId = safeId(raw.eventId, `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  return {
    eventId,
    batchId,
    eventType: safeString(raw.eventType, "UNKNOWN"),
    timestamp: safeString(raw.timestamp, nowIso()),
    receivedAt: nowIso(),

    source: safeString(raw.source || raw.sourceType || "unknown"),
    sourceType: safeString(raw.sourceType || ""),
    deviceSessionId: safeString(raw.deviceSessionId || ""),

    catalogueId: safeString(raw.catalogueId || ""),
    storefrontId: safeString(raw.storefrontId || ""),
    vendorId: safeString(raw.vendorId || ""),
    vendorName: safeString(raw.vendorName || ""),
    productId: safeString(raw.productId || ""),
    productName: safeString(raw.productName || ""),
    leadRef: safeString(raw.leadRef || ""),

    sector: safeString(raw.sector || ""),
    category: safeString(raw.category || ""),

    userAgent: safeString(req.headers["user-agent"] || "", ""),
    ipHashSource: safeString(req.ip || req.headers["x-forwarded-for"] || "", ""),

    payload: raw.payload && typeof raw.payload === "object" ? raw.payload : {},
  };
}

function mapCollectionForEvent(eventType) {
  switch (eventType) {
    case "SURVEY_ANSWERED":
    case "EXPIRY_SURVEY_OPENED":
      return "itred_catalogue_survey_responses";

    case "LEAD_FOLLOWUP_ANSWERED":
      return "itred_lead_followup_responses";

    case "NO_RESULTS_SEARCH":
      return "itred_product_demand_signals";

    case "WHATSAPP_VENDOR_CLICKED":
    case "CALL_VENDOR_CLICKED":
      return "itred_vendor_impact_events";

    case "HUB_LINK_CLICKED":
      return "itred_cah_impact_events";

    default:
      return "";
  }
}

exports.syncOfflineCommerceEvents = onRequest(
  {
    cors: true,
    maxInstances: 10,
  },
  async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, X-SCI-Sync-Key");
        return res.status(204).send("");
      }

      if (req.method !== "POST") {
        return res.status(405).json({
          ok: false,
          error: "METHOD_NOT_ALLOWED",
        });
      }

      const body = req.body || {};
      const events = Array.isArray(body.events) ? body.events : [];

      if (events.length === 0) {
        return res.status(400).json({
          ok: false,
          error: "NO_EVENTS",
        });
      }

      if (events.length > 200) {
        return res.status(413).json({
          ok: false,
          error: "TOO_MANY_EVENTS",
          maxEvents: 200,
        });
      }

      const batchId = safeId(
        body.batchId,
        `batch_${Date.now()}_${Math.random().toString(36).slice(2)}`
      );

      const batchRecord = {
        batchId,
        receivedAt: nowIso(),
        source: safeString(body.source || "unknown"),
        catalogueId: safeString(body.catalogueId || ""),
        storefrontId: safeString(body.storefrontId || ""),
        deviceSessionId: safeString(body.deviceSessionId || ""),
        sentAt: safeString(body.sentAt || ""),
        eventCount: events.length,
        userAgent: safeString(req.headers["user-agent"] || ""),
      };

      const writer = db.batch();

      writer.set(
        db.collection("itred_offline_sync_batches").doc(batchId),
        batchRecord,
        { merge: true }
      );

      const normalizedEvents = events.map((raw) =>
        normalizeEvent(
          {
            ...raw,
            source: body.source,
            catalogueId: raw.catalogueId || body.catalogueId,
            storefrontId: raw.storefrontId || body.storefrontId,
            deviceSessionId: raw.deviceSessionId || body.deviceSessionId,
          },
          batchId,
          req
        )
      );

      for (const event of normalizedEvents) {
        const rawRef = db.collection("itred_offline_events").doc(event.eventId);
        writer.set(rawRef, event, { merge: true });

        const mappedCollection = mapCollectionForEvent(event.eventType);
        if (mappedCollection) {
          writer.set(
            db.collection(mappedCollection).doc(event.eventId),
            event,
            { merge: true }
          );
        }
      }

      await writer.commit();

      return res.status(200).json({
        ok: true,
        batchId,
        received: normalizedEvents.length,
        syncedEventIds: normalizedEvents.map((e) => e.eventId),
      });
    } catch (error) {
      console.error("Offline sync failed", error);
      return res.status(500).json({
        ok: false,
        error: "SYNC_FAILED",
        message: error.message,
      });
    }
  }
);
