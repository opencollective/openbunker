'use client';

import EmailLogin from '@/app/(example)/_components/EmailLogin';

export default function EmailLoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Email Authentication
            </h1>
            <p className="text-lg text-gray-600">
              Login using your email address and receive a verification code
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <EmailLogin />
          </div>
        </div>
      </div>
    </div>
  );
}
