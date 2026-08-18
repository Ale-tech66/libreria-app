import { AnimatePresence, motion } from 'framer-motion';

import { AppShell } from './components/AppShell';
import { LoginScreen } from './components/auth/LoginScreen';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { sesion } = useAuth();

  return (
    <AnimatePresence mode="wait">
      {sesion ? (
        <motion.div
          key="app"
          style={{ height: '100%' }}
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <AppShell />
        </motion.div>
      ) : (
        <motion.div
          key="login"
          style={{ height: '100%' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <LoginScreen onEntrar={() => undefined} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}