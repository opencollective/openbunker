"use client";

import LoginOptions from "@/app/(example)/_components/LoginOptions";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                OpenBunker
              </span>
            </h1>
            <p className="text-lg text-gray-600">
              Choose your authentication method
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <LoginOptions />
          </div>
        </div>
      </div>
    </div>
  );
}
