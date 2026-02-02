export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#FDFDFD]">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-gray-200" />
        <div className="h-4 w-32 rounded bg-gray-200" />
      </div>
    </div>
  );
}
