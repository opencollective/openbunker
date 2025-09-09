'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

interface OpenBunkerLoginProps {
  isInPopup?: boolean;
}

export default function OpenBunkerLogin({
  isInPopup = false,
}: OpenBunkerLoginProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMagicLinkForm, setShowMagicLinkForm] = useState(false);
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const { authenticateWithOpenBunker, sendMagicLink, signIn, handleOtp } =
    useAuth();

  const handleOpenBunkerAuth = async () => {
    setLoading(true);
    setError('');

    try {
      const authUrl = await authenticateWithOpenBunker();
      console.log('authUrl', authUrl);
    } catch {
      setError('Failed to start OpenBunker authentication. Please try again.');
      setLoading(false);
    }
  };

  const handleSendMagicLink = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await sendMagicLink(email);
      setMagicLinkSent(true);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to send magic link'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signIn(email);
      setOtpSent(true);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to send verification code'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length < 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await handleOtp(email, otpCode);
      console.log('OTP verified successfully');
      // The auth state change will be handled by the AuthContext
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Authenticate with OpenBunker
        </h2>
        <p className="text-gray-600">
          Choose your preferred authentication method
        </p>
      </div>

      {error && (
        <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <button
          onClick={handleOpenBunkerAuth}
          disabled={loading}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-4 rounded-lg hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-3"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.736 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"
            />
          </svg>
          <span>
            {loading ? 'Opening OpenBunker...' : 'Start Discord OAuth'}
          </span>
        </button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">or</span>
          </div>
        </div>

        {/* Email Login Option - Different behavior for popup vs regular page */}
        {!showMagicLinkForm ? (
          <button
            onClick={() => setShowMagicLinkForm(true)}
            disabled={loading}
            className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-3"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
            <span>
              {isInPopup ? 'Login with Email & OTP' : 'Login with Magic Link'}
            </span>
          </button>
        ) : (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                disabled={isInPopup ? otpSent : magicLinkSent}
              />
            </div>

            {/* OTP Code input - only shown in popup after code is sent */}
            {isInPopup && otpSent && (
              <div>
                <label
                  htmlFor="otp"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Verification Code
                </label>
                <input
                  type="text"
                  id="otp"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg tracking-widest text-gray-900 placeholder-gray-500"
                />
              </div>
            )}

            {/* Action buttons based on context */}
            {isInPopup ? (
              // Popup: OTP flow
              !otpSent ? (
                <button
                  onClick={handleSendOTP}
                  disabled={loading || !email}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? 'Sending...' : 'Send Verification Code'}
                </button>
              ) : (
                <button
                  onClick={handleVerifyOTP}
                  disabled={loading || !otpCode || otpCode.length < 6}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? 'Verifying...' : 'Verify Code'}
                </button>
              )
            ) : // Regular page: Magic link flow
            !magicLinkSent ? (
              <button
                onClick={handleSendMagicLink}
                disabled={loading || !email}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? 'Sending...' : 'Send Magic Link'}
              </button>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Check your email for a magic link to complete login.
                </p>
              </div>
            )}

            {/* Status messages */}
            {isInPopup && otpSent && !otpCode && (
              <p className="text-sm text-gray-500">
                Check your email for a 6-digit verification code.
              </p>
            )}

            <button
              onClick={() => {
                setShowMagicLinkForm(false);
                setOtpSent(false);
                setOtpCode('');
                setEmail('');
              }}
              className="w-full text-gray-500 hover:text-gray-700 text-sm"
            >
              Back to options
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center">
          <p className="text-sm text-gray-600">Authentication in progress...</p>
        </div>
      )}

      <div className="text-center">
        <p className="text-xs text-gray-500">
          <strong>How it works:</strong> Choose between Discord OAuth for a new
          Nostr key or use{' '}
          {isInPopup
            ? 'email verification with OTP'
            : 'a magic link sent to your email'}
          .
        </p>
      </div>
    </div>
  );
}
