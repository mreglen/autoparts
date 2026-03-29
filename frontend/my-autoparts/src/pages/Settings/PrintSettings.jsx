import PrinterTokenSection from './PrinterTokenSection';
import LabelPrintSection from './LabelPrintSection';

export default function PrintSettings() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Печать</h2>
      </div>

      {/* Printers Section */}
      <div>
        <PrinterTokenSection />
      </div>

      {/* Label Print Settings Section */}
      <div>
        <LabelPrintSection />
      </div>
    </div>
  );
}
