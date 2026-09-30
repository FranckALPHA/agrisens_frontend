import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from '@/services/api/queryClient';
import { router } from '@/app/router';
import { FournisseurToast } from '@/components/Toast';

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <FournisseurToast>
        <RouterProvider router={router} />
      </FournisseurToast>
    </QueryClientProvider>
  );
};

export default App;
