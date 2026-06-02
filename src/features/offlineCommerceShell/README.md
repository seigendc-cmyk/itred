# iTred Offline Commerce Shell

This folder is the isolated foundation for a future iTred Offline Commerce Shell layer.

The model is shell + data pack:

- The shell is the installed offline storefront experience.
- Data packs are imported files that refresh vendors, products, access hub links, legal content, and support details.
- The current Catalogue Builder V2 remains unchanged and continues to own the existing single-file catalogue export flow.
- This layer is intended for larger multi-vendor offline commerce use cases where content updates must be separate from the shell.
- The shell will use IndexedDB for local offline storage.
- Future phases can add pack import, validation UI, IndexedDB persistence, PWA packaging, and APK packaging support.

This starter phase only defines the core data contracts, constants, validation/export helpers, and a placeholder builder page.

## Manual Test Checklist

1. Download shell.
2. Download data pack.
3. Open shell offline.
4. Import data pack.
5. Confirm vendors show.
6. Open vendor.
7. Search product.
8. Add to cart.
9. Enter customer name.
10. Enter delivery details.
11. Send WhatsApp sales lead.
12. Confirm expiry warning works.
13. Reopen offline and confirm data persists.

Debug mode is available by opening the generated shell with `?debug=1` or `#debug`.
