'use client';

import React, { useState } from 'react';
import { useSignUpEmailPassword } from '@nhost/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signUpEmailPassword, isLoading, isError, error, isSuccess } = useSignUpEmailPassword();
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const { isSuccess } = await signUpEmailPassword(email, password);
    if (isSuccess) {
      // By default Nhost might require email verification depending on settings. 
      // Assuming auto-login or simple redirect for now.
      router.push('/');
    }
  };

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-gray-900">Create an account</h2>
      </div>
      <form onSubmit={handleSignup} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm text-black"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm text-black"
            required
          />
        </div>

        {isError && (
          <div className="text-red-500 text-sm font-medium">
            {error?.message || 'Signup failed. Please try again.'}
          </div>
        )}

        {isSuccess && (
          <div className="text-green-600 text-sm font-medium">
            Account created successfully!
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400"
        >
          {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Sign up'}
        </button>
        
        <div className="text-center mt-4">
          <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500">
            Already have an account? Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
