"use client";
import { X } from "lucide-react";

export function FiltersDialog({ filters, setFilters, onClose }: { filters: any; setFilters: (f: any) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Filtre avansate</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tip Document</label>
              <select 
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-100 focus:border-blue-600" 
                value={filters.tipDocument} 
                onChange={(e) => setFilters({ ...filters, tipDocument: e.target.value, page: 1 })}
              >
                <option value="">(toate)</option>
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
            
            <div>
              <label className="block text-sm font-medium mb-2">Semnatar/Funcție</label>
              <select 
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-100 focus:border-blue-600" 
                value={filters.semnatarCat} 
                onChange={(e) => setFilters({ ...filters, semnatarCat: e.target.value, page: 1 })}
              >
                <option value="">(toate)</option>
                <option value="Inspector">Inspector Șef</option>
                <option value="Colonel">Colonel</option>
                <option value="Prim-adjunct">Prim-adjunct</option>
                <option value="Locotenent">Locotenent</option>
                <option value="plt.adj">plt.adj</option>
                <option value="Popescu">Popescu</option>
                <option value="Florea">Florea</option>
                <option value="Hantăr">Hantăr</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Perioada</label>
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="date" 
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-100 focus:border-blue-600" 
                  value={filters.dataStart ?? ""} 
                  onChange={(e) => setFilters({ ...filters, dataStart: e.target.value || undefined, page: 1 })} 
                  placeholder="Data început"
                />
                <input 
                  type="date" 
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-100 focus:border-blue-600" 
                  value={filters.dataEnd ?? ""} 
                  onChange={(e) => setFilters({ ...filters, dataEnd: e.target.value || undefined, page: 1 })} 
                  placeholder="Data sfârșit"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Interval numere</label>
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="number" 
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-100 focus:border-blue-600" 
                  value={filters.numarMin ?? ""} 
                  onChange={(e) => setFilters({ ...filters, numarMin: e.target.value ? Number(e.target.value) : undefined, page: 1 })} 
                  placeholder="Nr. minim"
                />
                <input 
                  type="number" 
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-100 focus:border-blue-600" 
                  value={filters.numarMax ?? ""} 
                  onChange={(e) => setFilters({ ...filters, numarMax: e.target.value ? Number(e.target.value) : undefined, page: 1 })} 
                  placeholder="Nr. maxim"
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between p-6 border-t bg-gray-50 rounded-b-2xl">
          <button 
            className="px-4 py-2 text-gray-600 hover:text-gray-900" 
            onClick={() => setFilters((f: any) => ({ ...f, tipDocument: "", semnatarCat: "", numarMin: undefined, numarMax: undefined, dataStart: undefined, dataEnd: undefined, page: 1 }))}
          >
            Resetează filtrele
          </button>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Anulează
            </button>
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Aplică filtrele
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
