"use client";

import { useState } from "react";

const PASSWORD = "irp@ISUDB25";

export default function ProceduriLucruPage() {
  const [authPassed, setAuthPassed] = useState(false);
  const [password, setPassword] = useState("");

  if (!authPassed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white rounded-2xl shadow p-6 w-full max-w-sm space-y-3">
          <div className="text-lg font-semibold text-gray-900">Acces restricționat</div>
          <div className="text-sm text-gray-600">Introdu parola pentru a continua.</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
            placeholder="Parolă"
          />
          <button
            type="button"
            onClick={() => {
              if (password === PASSWORD) setAuthPassed(true);
              else alert("Parolă greșită.");
            }}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Continuă
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm p-6">
        <div className="text-xl font-semibold text-gray-900">Proceduri de lucru</div>
        <div className="text-sm text-gray-600 mt-1">Conținutul va fi adăugat ulterior.</div>
      </div>
    </div>
  );
}
