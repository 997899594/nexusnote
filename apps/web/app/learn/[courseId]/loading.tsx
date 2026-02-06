export default function Loading() {
  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col">
      {/* Header Skeleton */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex-1">
            <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse mb-2"></div>
            <div className="h-4 bg-gray-100 rounded w-2/3 animate-pulse"></div>
          </div>
        </div>
      </header>

      {/* Content Skeleton */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Outline Skeleton */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6 animate-pulse">
            <div className="space-y-4">
              <div className="h-6 bg-gray-200 rounded w-2/3"></div>
              <div className="h-4 bg-gray-100 rounded w-full"></div>
              <div className="h-4 bg-gray-100 rounded w-5/6"></div>
            </div>
          </div>

          {/* Right: Chat Skeleton */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="bg-white rounded-lg shadow-sm p-4 animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-8 bg-gray-100 rounded"></div>
              <div className="h-8 bg-gray-100 rounded"></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
