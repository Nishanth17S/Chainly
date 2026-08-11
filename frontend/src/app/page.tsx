'use client';

import React, { useEffect } from 'react';
import { useAuthenticationStatus, useUserData, useSignOut } from '@nhost/react';
import { useRouter } from 'next/navigation';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useOrgContext } from '@/context/OrgContext';
import { Loader2, LogOut } from 'lucide-react';
import { WorkflowsContainer } from '@/components/workflows/WorkflowsContainer';

const GET_MY_ORGS = gql`
  query GetMyOrgs($userId: uuid!) {
    org_members(where: { user_id: { _eq: $userId } }) {
      org_id
      role
      organization {
        name
      }
    }
  }
`;

export default function DashboardPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthenticationStatus();
  const user = useUserData();
  const router = useRouter();
  const { signOut } = useSignOut();
  const { selectedOrgId, selectedRole, setSelectedOrg } = useOrgContext();

  const { data, loading: orgsLoading, error } = useQuery(GET_MY_ORGS, {
    variables: { userId: user?.id },
    skip: !user?.id || !!selectedOrgId, // Skip if no user, or if we already selected an org
  });

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthLoading, isAuthenticated, router]);

  // Auto-select if there is exactly 1 org and we haven't selected one yet
  useEffect(() => {
    if (data?.org_members && data.org_members.length === 1 && !selectedOrgId) {
      const member = data.org_members[0];
      setSelectedOrg(member.org_id, member.role);
    }
  }, [data, selectedOrgId, setSelectedOrg]);

  const handleSignOut = () => {
    // Clear local storage context and sign out
    localStorage.removeItem('chainly_org_id');
    localStorage.removeItem('chainly_role');
    signOut();
  };

  if (isAuthLoading || (orgsLoading && !error && !selectedOrgId)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // Org Selection State
  if (!selectedOrgId) {
    const members = data?.org_members || [];

    if (error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
          <div className="w-full max-w-md bg-white p-8 shadow rounded-lg text-center">
            <h2 className="text-xl font-bold mb-4 text-red-600">Error Loading Organizations</h2>
            <p className="text-gray-700 mb-6">{error.message}</p>
            <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-700">
              Sign out and try again
            </button>
          </div>
        </div>
      );
    }

    if (members.length === 0) {
      return (
        <div className="p-8 max-w-2xl mx-auto text-center mt-12 bg-white shadow rounded-lg">
          <h2 className="text-xl font-bold mb-4 text-gray-900">No Organizations Found</h2>
          <p className="text-gray-600 mb-6">You don't belong to any organizations yet.</p>
          <button onClick={handleSignOut} className="text-blue-600 font-medium hover:underline">
            Sign out
          </button>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white p-8 shadow rounded-lg">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">Select Organization</h2>
          <div className="space-y-3">
            {members.map((member: any) => (
              <button
                key={member.org_id}
                onClick={() => setSelectedOrg(member.org_id, member.role)}
                className="w-full text-left px-4 py-3 rounded border hover:border-blue-500 hover:bg-blue-50 transition-colors flex justify-between items-center"
              >
                <span className="font-medium text-gray-900">{member.organization.name}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded capitalize">
                  {member.role}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-8 text-center">
            <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-700">
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Shell
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-blue-600">Chainly</h1>
              <span className="text-sm px-3 py-1 bg-gray-100 rounded-full font-medium text-gray-700">
                Org ID: {selectedOrgId.substring(0, 8)}... ({selectedRole})
              </span>
            </div>
            <div>
              <button
                onClick={handleSignOut}
                className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900">Welcome to your workspace</h2>
          <p className="mt-1 text-sm text-gray-500">
            You are logged in as {user?.email} with the <strong>{selectedRole}</strong> role.
          </p>
          <div className="mt-8">
            <WorkflowsContainer />
          </div>
        </div>
      </main>
    </div>
  );
}
