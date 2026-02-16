import { Upload, Sliders, Download } from 'lucide-react';

interface EmptyStateProps {
  toolName: string;
  toolDescription: string;
}

export function EmptyState({ toolName, toolDescription }: EmptyStateProps) {
  return (
    <div className="text-center mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{toolName}</h3>
      <p className="text-sm text-gray-500 mb-6">{toolDescription}</p>
      <div className="flex justify-center gap-8 mb-8">
        {[
          { icon: Upload, label: 'Upload your PDF' },
          { icon: Sliders, label: 'Configure options' },
          { icon: Download, label: 'Preview & download' },
        ].map(({ icon: Icon, label }, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <Icon size={18} className="text-gray-400" />
            </div>
            <span className="text-xs text-gray-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
