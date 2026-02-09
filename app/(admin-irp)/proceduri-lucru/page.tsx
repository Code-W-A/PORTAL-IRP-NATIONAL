import ProceduriListClient from "@/components/proceduri-lucru/ProceduriListClient";
import { getProceduresSortedByUpdatedAtDesc } from "@/lib/proceduri-lucru/data";

export default function ProceduriLucruPage() {
  const procedures = getProceduresSortedByUpdatedAtDesc();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900">Proceduri de lucru</h1>
        <p className="text-sm text-gray-600">
          Bibliotecă internă de proceduri, cu filtre rapide și acces direct la detalii.
        </p>
      </div>
      <ProceduriListClient procedures={procedures} />
    </div>
  );
}

