export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-zinc-800" />
        <div className="w-12 h-12 rounded-full border-2 border-blue-500 border-t-transparent animate-spin absolute inset-0" />
      </div>
    </div>
  );
}
