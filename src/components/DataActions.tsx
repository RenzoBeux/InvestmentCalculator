import { useRef, useState, type ChangeEvent } from "react";
import {
  downloadPlanData,
  parsePlanData,
  readFileAsText,
  type PlanData,
} from "../exportData";
import { generatePlanPdf } from "../exportPdf";

interface Props {
  /** Datos actuales a exportar. */
  data: PlanData;
  /** Se llama con los datos saneados cuando el usuario importa un archivo. */
  onImport: (data: PlanData) => void;
}

/**
 * Barra de acciones del plan: exportar los datos a JSON, importarlos de vuelta y
 * guardar un PDF (vía el diálogo de impresión del navegador). Se oculta al
 * imprimir para no aparecer en el PDF.
 */
export function DataActions({ data, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  async function handlePdf() {
    setError(null);
    setPdfBusy(true);
    try {
      await generatePlanPdf(data);
    } catch {
      setError("No se pudo generar el PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reseteamos para poder volver a elegir el mismo archivo más tarde.
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const result = parsePlanData(await readFileAsText(file));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const confirmed = window.confirm(
        "Esto reemplazará los datos que tenés cargados con los del archivo. ¿Continuar?"
      );
      if (confirmed) onImport(result.data);
    } catch {
      setError("No se pudo leer el archivo.");
    }
  }

  return (
    <div className="plan-toolbar">
      <button
        type="button"
        className="btn-tool"
        onClick={() => downloadPlanData(data)}
      >
        <DownloadIcon />
        Exportar datos
      </button>

      <button
        type="button"
        className="btn-tool"
        onClick={() => fileRef.current?.click()}
      >
        <UploadIcon />
        Importar datos
      </button>

      <button
        type="button"
        className="btn-tool"
        onClick={handlePdf}
        disabled={pdfBusy}
      >
        <PdfIcon />
        {pdfBusy ? "Generando…" : "Guardar PDF"}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        tabIndex={-1}
        aria-label="Importar datos desde un archivo JSON"
        onChange={handleFile}
      />

      {error && (
        <span className="plan-toolbar-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

const ICON_PROPS = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function DownloadIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}
