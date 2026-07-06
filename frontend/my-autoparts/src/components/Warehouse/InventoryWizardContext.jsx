import { createContext, useContext } from 'react';

const InventoryWizardContext = createContext(null);

export function InventoryWizardProvider({ value, children }) {
  return (
    <InventoryWizardContext.Provider value={value}>
      {children}
    </InventoryWizardContext.Provider>
  );
}

export function useInventoryWizard() {
  const ctx = useContext(InventoryWizardContext);
  if (!ctx) {
    throw new Error('useInventoryWizard must be used within InventoryWizardProvider');
  }
  return ctx;
}

export default InventoryWizardContext;
