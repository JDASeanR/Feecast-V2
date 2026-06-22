export default function PlaceholderTab({ label, appState }) {
  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-64 text-center">
      <div className="text-4xl text-sand-3 mb-3">
        <i className="ti ti-tools" />
      </div>
      <div className="font-display text-2xl text-dark-3 mb-1">{label}</div>
      <div className="text-xs text-olive">
        This tab is coming soon in the React rebuild.
      </div>
      {appState && (
        <div className="mt-4 text-2xs text-dark-3 bg-sand rounded px-3 py-2">
          {appState.projects.length} projects · {appState.invoices.length} invoices · {appState.opportunities.length} opportunities loaded
        </div>
      )}
    </div>
  )
}
