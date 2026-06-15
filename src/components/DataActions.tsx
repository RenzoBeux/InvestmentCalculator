import { useRef, useState, type ChangeEvent } from "react";
import {
  downloadPlanData,
  parsePlanData,
  readFileAsText,
  type PlanData,
} from "../exportData";
import { generatePlanPdf } from "../exportPdf";
import { buildShareUrl } from "../shareUrl";

interface Props {
  /** Current data to export. */
  data: PlanData;
  /** Called with the sanitized data when the user imports a file. */
  onImport: (data: PlanData) => void;
}

/**
 * Plan action bar: export the data to JSON, import it back, and
 * save a PDF (via the browser's print dialog). Hidden when
 * printing so it doesn't show up in the PDF.
 */
export function DataActions({ data, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    setError(null);
    try {
      await navigator.clipboard.writeText(buildShareUrl(data));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar el enlace.");
    }
  }

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
    // Reset so the same file can be selected again later.
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

      <button type="button" className="btn-tool" onClick={handleShare}>
        <LinkIcon />
        {copied ? "¡Enlace copiado!" : "Copiar enlace"}
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

function LinkIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M9 12a3 3 0 0 1 3-3h4a3 3 0 1 1 0 6h-1" />
      <path d="M15 12a3 3 0 0 1-3 3H8a3 3 0 1 1 0-6h1" />
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
