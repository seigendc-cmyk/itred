import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wifi, 
  MapPin, 
  Battery, 
  Server, 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  X, 
  Activity, 
  AlertTriangle,
  CheckCircle2,
  Box,
  MonitorSmartphone,
  Phone,
  Power
} from 'lucide-react';
import { 
  TablePanel, 
  StatusBadge, 
  PrimaryButton, 
  SecondaryButton,
  EmptyState, 
  StatCard
} from './CommonUI.tsx';
import { permissionService } from '../services/permissionService.ts';
import { cahService } from '../services/cahService.ts';
import { logService } from '../services/logService.ts';
import { analyticsService } from '../services/analyticsService.ts';
import { CAHBooth, CAHBoothAsset, CAHBoothStatus, CAHBoothInternetStatus, CAHBoothAssetCondition } from '../types.ts';

const BOOTH_STATUSES: CAHBoothStatus[] = ['planned', 'active', 'maintenance', 'suspended', 'closed'];
const INTERNET_STATUSES: CAHBoothInternetStatus[] = ['active', 'unstable', 'offline', 'suspended'];
const ASSET_CONDITIONS: CAHBoothAssetCondition[] = ['new', 'good', 'fair', 'damaged', 'missing'];

export const CAHBoothsPanel: React.FC = () => {
  const [booths, setBooths] = useState<CAHBooth[]>([]);
  const [assets, setAssets] = useState<CAHBoothAsset[]>([]);
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [provinceFilter, setProvinceFilter] = useState('all');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBooth, setEditingBooth] = useState<Partial<CAHBooth> | null>(null);

  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(null);
  const [isAssetFormOpen, setIsAssetFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Partial<CAHBoothAsset> | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setBooths(cahService.getBooths());
    setAssets(cahService.getBoothAssets());
  };

  const provinces = useMemo(() => Array.from(new Set(booths.map(b => b.province).filter(Boolean))), [booths]);

  const filteredBooths = useMemo(() => {
    return booths.filter(b => {
      const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase()) || 
                             b.code.toLowerCase().includes(search.toLowerCase()) ||
                             b.cityTown.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      const matchesProvince = provinceFilter === 'all' || b.province === provinceFilter;
      return matchesSearch && matchesStatus && matchesProvince;
    });
  }, [booths, search, statusFilter, provinceFilter]);

  const stats = useMemo(() => {
    const activeBooths = booths.filter(b => b.status === 'active');
    return {
      total: booths.length,
      active: activeBooths.length,
      offline: activeBooths.filter(b => b.internetStatus === 'offline' || b.internetStatus === 'unstable').length,
      maintenance: booths.filter(b => b.status === 'maintenance').length,
      assetsNeedingCheck: assets.filter(a => a.condition === 'damaged' || a.condition === 'missing').length
    };
  }, [booths, assets]);

  const handleCreateBooth = () => {
    setEditingBooth({
      id: `BOOTH-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      code: `CB-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      status: 'planned',
      internetStatus: 'offline',
      powerSource: 'grid',
      internetType: 'Fibre',
      supportedSectors: [],
      linkedWhatsappGroupIds: [],
    });
    setIsFormOpen(true);
  };

  const handleSaveBooth = async () => {
    if (!editingBooth?.name || !editingBooth?.province || !editingBooth?.cityTown) {
      alert('Name, Province and City are required.');
      return;
    }

    const boothToSave = {
      ...editingBooth,
      createdBy: editingBooth.createdBy || 'STAFF-ADM',
      updatedBy: 'STAFF-ADM',
    } as CAHBooth;

    try {
      await cahService.saveBooth(boothToSave);
  
      const isNew = !editingBooth.createdAt;
      
      analyticsService.logEvent({
        eventType: isNew ? 'CAH_BOOTH_CREATED' : 'CAH_BOOTH_UPDATED',
        actorType: 'admin',
        actorName: 'System Admin',
        cahBoothId: boothToSave.id,
        details: { name: boothToSave.name, code: boothToSave.code }
      });
  
      logService.add({
        userId: 'STAFF-ADM',
        action: isNew ? 'CAH_BOOTH_CREATED' : 'CAH_BOOTH_UPDATED',
        entityType: 'cah_booth',
        entityId: boothToSave.id,
        details: `CAH Booth "${boothToSave.name}" was ${isNew ? 'created' : 'updated'}.`,
        severity: 'info'
      });
  
      loadData();
      setIsFormOpen(false);
      setEditingBooth(null);
      alert("Saved successfully");
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Save failed");
    }
  };

  const handleCreateAsset = (boothId: string) => {
    setEditingAsset({
      id: `AST-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      boothId,
      type: 'other',
      condition: 'new',
      assignedDate: new Date().toISOString().split('T')[0],
      lastCheckedDate: new Date().toISOString().split('T')[0]
    });
    setIsAssetFormOpen(true);
  };

  const handleSaveAsset = async () => {
    if (!editingAsset?.name || !editingAsset?.serialNumber) {
      alert('Name and Serial Number are required.');
      return;
    }

    const assetToSave = {
      ...editingAsset,
      checkedById: editingAsset.checkedById || 'STAFF-ADM',
      createdBy: editingAsset.createdBy || 'STAFF-ADM',
      updatedBy: 'STAFF-ADM',
    } as CAHBoothAsset;

    try {
      await cahService.saveBoothAsset(assetToSave);
  
      const isNew = !editingAsset.createdAt;
      let eventType = isNew ? 'CAH_ASSET_ADDED' : 'CAH_ASSET_UPDATED';
      if (!isNew && assetToSave.condition === 'damaged') eventType = 'CAH_ASSET_MARKED_DAMAGED';
      if (!isNew && assetToSave.condition === 'missing') eventType = 'CAH_ASSET_MARKED_MISSING';
  
      analyticsService.logEvent({
        eventType: eventType as any,
        actorType: 'admin',
        actorName: 'System Admin',
        cahBoothId: assetToSave.boothId,
        details: { name: assetToSave.name, condition: assetToSave.condition }
      });
  
      loadData();
      setIsAssetFormOpen(false);
      setEditingAsset(null);
      alert("Saved successfully");
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Save failed");
    }
  };

  const selectedBoothAssets = selectedBoothId ? assets.filter(a => a.boothId === selectedBoothId) : [];

  return (
    <div className="space-y-6">
      {/* Infrastructure Bar */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard label="Total Booths" value={stats.total.toString()} icon={Server} />
        <StatCard label="Active Booths" value={stats.active.toString()} icon={Activity} variant={stats.active > 0 ? 'success' : 'neutral'} />
        <StatCard label="Offline/Unstable" value={stats.offline.toString()} icon={Wifi} variant={stats.offline > 0 ? 'danger' : 'neutral'} />
        <StatCard label="In Maintenance" value={stats.maintenance.toString()} icon={AlertTriangle} variant={stats.maintenance > 0 ? 'warning' : 'neutral'} />
        <StatCard label="Damaged Assets" value={stats.assetsNeedingCheck.toString()} icon={Box} variant={stats.assetsNeedingCheck > 0 ? 'danger' : 'neutral'} />
      </div>

      <div className="bg-white border border-stone-200 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-1 gap-2 w-full">
           <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
              <input 
                type="text" 
                placeholder="SEARCH BOOTHS..." 
                className="w-full pl-10 pr-4 py-2 border-2 border-stone-100 outline-none focus:border-brand-orange text-xs font-bold uppercase"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
           </div>
           <select className="border-2 border-stone-100 p-2 text-xs font-bold uppercase outline-none focus:border-brand-orange" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">ALL STATUSES</option>
              {BOOTH_STATUSES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
           </select>
           <select className="border-2 border-stone-100 p-2 text-xs font-bold uppercase outline-none focus:border-brand-orange" value={provinceFilter} onChange={e => setProvinceFilter(e.target.value)}>
              <option value="all">ALL PROVINCES</option>
              {provinces.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
           </select>
        </div>
        {permissionService.canCreate("cahBooths") && <PrimaryButton onClick={handleCreateBooth} className="flex items-center gap-2 whitespace-nowrap">
          <Plus size={14} /> Deploy New Booth
        </PrimaryButton>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
           {filteredBooths.map(booth => (
             <div key={booth.id} 
                  className={`bg-white border-2 p-4 cursor-pointer transition-colors ${selectedBoothId === booth.id ? 'border-brand-orange' : 'border-stone-100 hover:border-stone-200'}`}
                  onClick={() => setSelectedBoothId(booth.id)}
              >
               <div className="flex justify-between items-start mb-2">
                 <div>
                   <h3 className="text-sm font-bold uppercase text-brand-charcoal flex items-center gap-2">
                     {booth.name} <span className="text-[10px] text-stone-400 font-mono">[{booth.code}]</span>
                   </h3>
                   <p className="text-[10px] text-stone-500 uppercase flex items-center gap-1 mt-1">
                     <MapPin size={10} /> {booth.suburb || 'N/A'}, {booth.cityTown}, {booth.province}
                   </p>
                 </div>
                 <div className="flex items-center gap-2">
                   <StatusBadge status={booth.status} variant={booth.status === 'active' ? 'success' : booth.status === 'maintenance' ? 'warning' : 'neutral'} />
                   {permissionService.canEdit("cahBooths") && <button onClick={(e) => { e.stopPropagation(); setEditingBooth(booth); setIsFormOpen(true); }} className="p-1 text-stone-400 hover:text-brand-orange"><Edit3 size={14}/></button>}
                 </div>
               </div>

               <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-stone-50">
                 <div className="flex items-center gap-2">
                   <div className={`p-1.5 rounded-full ${booth.internetStatus === 'active' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                     <Wifi size={12} />
                   </div>
                   <div>
                     <p className="text-[8px] font-bold text-stone-400 uppercase">Connectivity</p>
                     <p className="text-[10px] font-bold uppercase">{booth.internetType} ({booth.internetStatus})</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="p-1.5 rounded-full bg-stone-100 text-stone-600">
                     <Power size={12} />
                   </div>
                   <div>
                     <p className="text-[8px] font-bold text-stone-400 uppercase">Power</p>
                     <p className="text-[10px] font-bold uppercase">{booth.powerSource}</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="p-1.5 rounded-full bg-stone-100 text-stone-600">
                     <Box size={12} />
                   </div>
                   <div>
                     <p className="text-[8px] font-bold text-stone-400 uppercase">Assets</p>
                     <p className="text-[10px] font-bold uppercase">{assets.filter(a => a.boothId === booth.id).length} Tracked</p>
                   </div>
                 </div>
               </div>
             </div>
           ))}
           {filteredBooths.length === 0 && (
             <EmptyState icon={Server} title="No Booths Found" description="Try adjusting your filters." />
           )}
        </div>

        <div className="lg:col-span-1">
          {selectedBoothId ? (
            <div className="bg-white border-2 border-stone-100 p-4 sticky top-6">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-stone-100">
                <h4 className="text-xs font-bold uppercase text-brand-charcoal">Booth Asset Register</h4>
                {permissionService.canCreate("cahBooths") && (
                  <button onClick={() => handleCreateAsset(selectedBoothId)} className="text-[10px] font-bold uppercase text-brand-orange hover:text-brand-charcoal flex items-center gap-1">
                    <Plus size={10} /> Add Asset
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {selectedBoothAssets.map(asset => (
                  <div key={asset.id} className="bg-stone-50 border border-stone-200 p-3 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold uppercase flex items-center gap-1">
                         {asset.type === 'router' ? <Wifi size={10}/> : asset.type === 'Starlink kit' ? <MonitorSmartphone size={10} /> : <Box size={10}/>}
                         {asset.name}
                      </p>
                      <p className="text-[8px] text-stone-500 font-mono mt-0.5">SN: {asset.serialNumber}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] px-1.5 py-0.5 uppercase font-bold ${asset.condition === 'new' || asset.condition === 'good' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {asset.condition}
                      </span>
                      {permissionService.canEdit("cahBooths") && <button onClick={() => { setEditingAsset(asset); setIsAssetFormOpen(true); }} className="text-stone-400 hover:text-brand-orange"><Edit3 size={12}/></button>}
                    </div>
                  </div>
                ))}
                {selectedBoothAssets.length === 0 && (
                  <div className="text-center py-6 text-stone-400">
                    <Box size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-[10px] uppercase font-bold">No assets registered</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-stone-50 border-2 border-stone-100 border-dashed p-8 text-center flex flex-col items-center justify-center text-stone-400 h-full min-h-[300px]">
              <Server size={32} className="mb-4 opacity-50" />
              <p className="text-xs font-bold uppercase">Select a Booth</p>
              <p className="text-[10px]">Click a booth to view its asset register</p>
            </div>
          )}
        </div>
      </div>

      {/* Booth Editor Form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-brand-charcoal/40 backdrop-blur-sm">
           <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50 border-l border-stone-200">
                 <div>
                    <h2 className="text-lg font-bold uppercase tracking-tight">{editingBooth?.createdAt ? 'Edit Booth Profile' : 'Deploy New Booth'}</h2>
                 </div>
                 <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-stone-100"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                 {/* Booth Details Form Fields */}
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] uppercase font-bold text-stone-400">Booth Name</label>
                       <input className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                        value={editingBooth?.name || ''} onChange={e => setEditingBooth({...editingBooth!, name: e.target.value})} placeholder="e.g. Mbare Hub 1" />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] uppercase font-bold text-stone-400">Booth Code</label>
                       <input className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                        value={editingBooth?.code || ''} onChange={e => setEditingBooth({...editingBooth!, code: e.target.value})} />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] uppercase font-bold text-stone-400">Province</label>
                       <input className="w-full border-2 border-stone-100 p-3 text-xs uppercase outline-none focus:border-brand-orange"
                        value={editingBooth?.province || ''} onChange={e => setEditingBooth({...editingBooth!, province: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] uppercase font-bold text-stone-400">City/Town</label>
                       <input className="w-full border-2 border-stone-100 p-3 text-xs uppercase outline-none focus:border-brand-orange"
                        value={editingBooth?.cityTown || ''} onChange={e => setEditingBooth({...editingBooth!, cityTown: e.target.value})} />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] uppercase font-bold text-stone-400">District</label>
                       <input className="w-full border-2 border-stone-100 p-3 text-xs uppercase outline-none focus:border-brand-orange"
                        value={editingBooth?.district || ''} onChange={e => setEditingBooth({...editingBooth!, district: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] uppercase font-bold text-stone-400">Suburb</label>
                       <input className="w-full border-2 border-stone-100 p-3 text-xs uppercase outline-none focus:border-brand-orange"
                        value={editingBooth?.suburb || ''} onChange={e => setEditingBooth({...editingBooth!, suburb: e.target.value})} />
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-stone-400">Street / Location Description</label>
                    <textarea rows={2} className="w-full border-2 border-stone-100 p-3 text-xs outline-none focus:border-brand-orange"
                     value={editingBooth?.streetLocation || ''} onChange={e => setEditingBooth({...editingBooth!, streetLocation: e.target.value})} />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] uppercase font-bold text-stone-400">Host Name</label>
                       <input className="w-full border-2 border-stone-100 p-3 text-xs uppercase outline-none focus:border-brand-orange"
                        value={editingBooth?.hostName || ''} onChange={e => setEditingBooth({...editingBooth!, hostName: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] uppercase font-bold text-stone-400">Host Phone (Internal)</label>
                       <input className="w-full border-2 border-stone-100 p-3 text-xs uppercase outline-none focus:border-brand-orange"
                        value={editingBooth?.hostPhone || ''} onChange={e => setEditingBooth({...editingBooth!, hostPhone: e.target.value})} />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] uppercase font-bold text-stone-400">Internet Type</label>
                       <select className="w-full border-2 border-stone-100 p-3 text-xs uppercase outline-none focus:border-brand-orange"
                        value={editingBooth?.internetType || 'Fibre'} onChange={e => setEditingBooth({...editingBooth!, internetType: e.target.value as any})}>
                         {['Starlink', 'Fibre', 'LTE', 'WiFi partner', 'Other'].map(o => <option key={o} value={o}>{o}</option>)}
                       </select>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] uppercase font-bold text-stone-400">Power Source</label>
                       <select className="w-full border-2 border-stone-100 p-3 text-xs uppercase outline-none focus:border-brand-orange"
                        value={editingBooth?.powerSource || 'grid'} onChange={e => setEditingBooth({...editingBooth!, powerSource: e.target.value as any})}>
                         {['grid', 'solar', 'battery', 'generator', 'mixed'].map(o => <option key={o} value={o}>{o}</option>)}
                       </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] uppercase font-bold text-stone-400">Booth Status</label>
                       <select className="w-full border-2 border-stone-100 p-3 text-xs uppercase font-bold outline-none focus:border-brand-orange"
                        value={editingBooth?.status || 'planned'} onChange={e => setEditingBooth({...editingBooth!, status: e.target.value as any})}>
                         {BOOTH_STATUSES.map(o => <option key={o} value={o}>{o}</option>)}
                       </select>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] uppercase font-bold text-stone-400">Internet Status</label>
                       <select className="w-full border-2 border-stone-100 p-3 text-xs uppercase font-bold outline-none focus:border-brand-orange"
                        value={editingBooth?.internetStatus || 'offline'} onChange={e => setEditingBooth({...editingBooth!, internetStatus: e.target.value as any})}>
                         {INTERNET_STATUSES.map(o => <option key={o} value={o}>{o}</option>)}
                       </select>
                    </div>
                 </div>
                 
                 <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-stone-400">Customer Access Notes</label>
                    <textarea rows={2} className="w-full border-2 border-stone-100 p-3 text-xs outline-none focus:border-brand-orange"
                     value={editingBooth?.customerAccessNotes || ''} onChange={e => setEditingBooth({...editingBooth!, customerAccessNotes: e.target.value})} placeholder="e.g. Free access 8am - 5pm" />
                 </div>
              </div>

              <div className="p-6 border-t border-stone-100 bg-stone-50 flex gap-4">
                 <SecondaryButton className="flex-1" onClick={() => setIsFormOpen(false)}>Cancel</SecondaryButton>
                 {permissionService.canCreate("cahBooths") || permissionService.canEdit("cahBooths") ? <PrimaryButton className="flex-1" onClick={handleSaveBooth}>Save Booth Configuration</PrimaryButton> : null}
              </div>
           </div>
        </div>
      )}

      {/* Asset Editor Form */}
      {isAssetFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-charcoal/40 backdrop-blur-sm p-4">
           <div className="w-full max-w-md bg-white shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 rounded-sm overflow-hidden">
              <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                 <h2 className="text-sm font-bold uppercase tracking-tight">{editingAsset?.createdAt ? 'Edit Asset' : 'Register New Asset'}</h2>
                 <button onClick={() => setIsAssetFormOpen(false)} className="p-1 hover:bg-stone-200 text-stone-400"><X size={16} /></button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                   <label className="text-[10px] uppercase font-bold text-stone-400">Asset Type</label>
                   <select className="w-full border-2 border-stone-100 p-2 text-xs uppercase outline-none focus:border-brand-orange"
                    value={editingAsset?.type || 'other'} onChange={e => setEditingAsset({...editingAsset!, type: e.target.value as any})}>
                     {['router', 'Starlink kit', 'table', 'chair', 'signage', 'phone', 'tablet', 'laptop', 'power bank', 'solar equipment', 'printer', 'other'].map(o => <option key={o} value={o}>{o}</option>)}
                   </select>
                </div>
                
                <div className="space-y-1.5">
                   <label className="text-[10px] uppercase font-bold text-stone-400">Asset Name/Model</label>
                   <input className="w-full border-2 border-stone-100 p-2 text-xs uppercase outline-none focus:border-brand-orange"
                    value={editingAsset?.name || ''} onChange={e => setEditingAsset({...editingAsset!, name: e.target.value})} placeholder="e.g. TP-Link MR600" />
                </div>

                <div className="space-y-1.5">
                   <label className="text-[10px] uppercase font-bold text-stone-400">Serial Number</label>
                   <input className="w-full border-2 border-stone-100 p-2 text-xs font-mono outline-none focus:border-brand-orange"
                    value={editingAsset?.serialNumber || ''} onChange={e => setEditingAsset({...editingAsset!, serialNumber: e.target.value})} />
                </div>

                <div className="space-y-1.5">
                   <label className="text-[10px] uppercase font-bold text-stone-400">Condition</label>
                   <select className="w-full border-2 border-stone-100 p-2 text-xs uppercase outline-none focus:border-brand-orange font-bold"
                    value={editingAsset?.condition || 'new'} onChange={e => setEditingAsset({...editingAsset!, condition: e.target.value as any})}>
                     {ASSET_CONDITIONS.map(o => <option key={o} value={o}>{o}</option>)}
                   </select>
                </div>

                <div className="space-y-1.5">
                   <label className="text-[10px] uppercase font-bold text-stone-400">Notes</label>
                   <textarea rows={2} className="w-full border-2 border-stone-100 p-2 text-xs outline-none focus:border-brand-orange"
                    value={editingAsset?.notes || ''} onChange={e => setEditingAsset({...editingAsset!, notes: e.target.value})} />
                </div>
              </div>

              <div className="p-4 border-t border-stone-100 bg-stone-50 flex gap-2 justify-end">
                 <SecondaryButton onClick={() => setIsAssetFormOpen(false)}>Cancel</SecondaryButton>
                 {permissionService.canCreate("cahBooths") || permissionService.canEdit("cahBooths") ? <PrimaryButton onClick={handleSaveAsset}>Save Asset</PrimaryButton> : null}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
