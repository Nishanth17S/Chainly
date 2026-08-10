'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type OrgContextType = {
  selectedOrgId: string | null;
  selectedRole: string | null;
  setSelectedOrg: (orgId: string, role: string) => void;
};

const OrgContext = createContext<OrgContextType>({
  selectedOrgId: null,
  selectedRole: null,
  setSelectedOrg: () => {},
});

export const OrgProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Load from local storage on mount
  useEffect(() => {
    const orgId = localStorage.getItem('chainly_org_id');
    const role = localStorage.getItem('chainly_role');
    if (orgId && role) {
      setSelectedOrgId(orgId);
      setSelectedRole(role);
    }
  }, []);

  const setSelectedOrg = (orgId: string, role: string) => {
    setSelectedOrgId(orgId);
    setSelectedRole(role);
    localStorage.setItem('chainly_org_id', orgId);
    localStorage.setItem('chainly_role', role);
  };

  return (
    <OrgContext.Provider value={{ selectedOrgId, selectedRole, setSelectedOrg }}>
      {children}
    </OrgContext.Provider>
  );
};

export const useOrgContext = () => useContext(OrgContext);
