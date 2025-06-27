'use client';

import OpenBunkerLogin from '@/components/OpenBunkerLogin';

export default function OpenBunkerLoginPopup() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              OpenBunker
            </h1>
            <p className="text-gray-600">
              Authentication
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <OpenBunkerLogin />
          </div>
        </div>
      </div>
    </div>
  );
} 