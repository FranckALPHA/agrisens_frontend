import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from '@/services/api/queryClient';
import { router } from '@/app/router';
import { FournisseurToast } from '@/components/Toast';
import { initialiserSession } from '@/services/sessionService';

export const App: React.FC = () => {
  // Rafraîchissement silencieux au chargement (prompt F-02 frontend point 4) :
  // si le cookie httpOnly de rafraîchissement survit, la session est rétablie
  // sans redemander identifiants (idempotent grâce au single-flight).
  useEffect(() => {
    void initialiserSession();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <FournisseurToast>
        <RouterProvider router={router} />
      </FournisseurToast>
    </QueryClientProvider>
  );
};

export default App;
