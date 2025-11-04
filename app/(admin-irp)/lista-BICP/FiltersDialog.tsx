"use client";
import { X, Filter, Calendar, Hash, User, FileText, Briefcase, Award } from "lucide-react";
import { useState } from "react";

export function FiltersDialog({ filters, setFilters, onClose }: { filters: any; setFilters: (f: any) => void; onClose: () => void }) {
  const [localFilters, setLocalFilters] = useState(filters);
  
  const handleApply = () => {
    setFilters({ ...localFilters, page: 1 });
    onClose();
  };
  
  const handleReset = () => {
    const resetFilters = {
      ...localFilters,
      tipDocument: "",
      semnatarCat: "",
      numarMin: undefined,
      numarMax: undefined,
      dataStart: undefined,
      dataEnd: undefined,
      numeSemnatar: "",
      grad: "",
      functia: "",
      pentru: "",
      purtatorCuvant: "",
      page: 1
    };
    setLocalFilters(resetFilters);
    setFilters(resetFilters);
  };
  
  const activeFiltersCount = [
    localFilters.tipDocument,
    localFilters.semnatarCat,
    localFilters.numarMin,
    localFilters.numarMax,
    localFilters.dataStart,
    localFilters.dataEnd,
    localFilters.numeSemnatar,
    localFilters.grad,
    localFilters.functia,
    localFilters.pentru,
    localFilters.purtatorCuvant,
  ].filter(Boolean).length;
  
  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg">
              <Filter size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Filtre avansate</h2>
              {activeFiltersCount > 0 && (
                <p className="text-sm text-gray-600 mt-0.5">
                  {activeFiltersCount} {activeFiltersCount === 1 ? "filtru activ" : "filtre active"}
                </p>
              )}
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/80 rounded-xl transition-colors"
            title="Închide"
          >
            <X size={22} className="text-gray-600" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Tip Document */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <FileText size={16} className="text-blue-600" />
              Tip Document
            </label>
            <select 
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-gray-900 shadow-sm hover:border-gray-400" 
              value={localFilters.tipDocument} 
              onChange={(e) => setLocalFilters({ ...localFilters, tipDocument: e.target.value })}
            >
              <option value="">Toate tipurile</option>
              {[
                "Buletin Informativ",
                "Comunicat de Presă", 
                "Știre",
                "Declarație de presă",
                "Conferință de presă",
                "Invitație",
                "Interviu", 
                "Anunț",
                "Eveniment de presă",
                "Drept la replică"
              ].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User size={18} className="text-indigo-600" />
              Informații Semnatar
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <User size={14} className="text-gray-500" />
                  Nume Semnatar
                </label>
                <input 
                  type="text"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-gray-900 shadow-sm hover:border-gray-400" 
                  value={localFilters.numeSemnatar ?? ""} 
                  onChange={(e) => setLocalFilters({ ...localFilters, numeSemnatar: e.target.value || undefined })}
                  placeholder="Ex: Popescu, Ion"
                />
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Award size={14} className="text-gray-500" />
                  Grad
                </label>
                <input 
                  type="text"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-gray-900 shadow-sm hover:border-gray-400" 
                  value={localFilters.grad ?? ""} 
                  onChange={(e) => setLocalFilters({ ...localFilters, grad: e.target.value || undefined })}
                  placeholder="Ex: Colonel, Locotenent"
                />
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Briefcase size={14} className="text-gray-500" />
                  Funcția
                </label>
                <input 
                  type="text"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-gray-900 shadow-sm hover:border-gray-400" 
                  value={localFilters.functia ?? ""} 
                  onChange={(e) => setLocalFilters({ ...localFilters, functia: e.target.value || undefined })}
                  placeholder="Ex: Inspector Șef"
                />
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <User size={14} className="text-gray-500" />
                  Pentru
                </label>
                <input 
                  type="text"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-gray-900 shadow-sm hover:border-gray-400" 
                  value={localFilters.pentru ?? ""} 
                  onChange={(e) => setLocalFilters({ ...localFilters, pentru: e.target.value || undefined })}
                  placeholder="Destinatar"
                />
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <User size={14} className="text-gray-500" />
                  Purtător de Cuvânt
                </label>
                <input 
                  type="text"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-gray-900 shadow-sm hover:border-gray-400" 
                  value={localFilters.purtatorCuvant ?? ""} 
                  onChange={(e) => setLocalFilters({ ...localFilters, purtatorCuvant: e.target.value || undefined })}
                  placeholder="Nume purtător de cuvânt"
                />
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-green-600" />
              Interval Date
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Calendar size={14} className="text-gray-500" />
                  Data început
                </label>
                <input 
                  type="date" 
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-gray-900 shadow-sm hover:border-gray-400" 
                  value={localFilters.dataStart ?? ""} 
                  onChange={(e) => setLocalFilters({ ...localFilters, dataStart: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Calendar size={14} className="text-gray-500" />
                  Data sfârșit
                </label>
                <input 
                  type="date" 
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-gray-900 shadow-sm hover:border-gray-400" 
                  value={localFilters.dataEnd ?? ""} 
                  onChange={(e) => setLocalFilters({ ...localFilters, dataEnd: e.target.value || undefined })}
                />
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Hash size={18} className="text-purple-600" />
              Interval Numere Document
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Hash size={14} className="text-gray-500" />
                  Număr minim
                </label>
                <input 
                  type="number" 
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-gray-900 shadow-sm hover:border-gray-400" 
                  value={localFilters.numarMin ?? ""} 
                  onChange={(e) => setLocalFilters({ ...localFilters, numarMin: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="Ex: 1"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Hash size={14} className="text-gray-500" />
                  Număr maxim
                </label>
                <input 
                  type="number" 
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-gray-900 shadow-sm hover:border-gray-400" 
                  value={localFilters.numarMax ?? ""} 
                  onChange={(e) => setLocalFilters({ ...localFilters, numarMax: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="Ex: 100"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50/80">
          <button 
            className="px-5 py-2.5 text-gray-700 hover:text-gray-900 font-medium hover:bg-white rounded-xl transition-all flex items-center gap-2 shadow-sm" 
            onClick={handleReset}
          >
            <X size={16} />
            Resetează toate filtrele
          </button>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-300 rounded-xl hover:bg-white font-medium text-gray-700 transition-all shadow-sm"
            >
              Anulează
            </button>
            <button 
              onClick={handleApply}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-semibold transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2"
            >
              <Filter size={16} />
              Aplică filtrele
              {activeFiltersCount > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
