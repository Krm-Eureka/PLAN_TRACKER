type Listener = () => void;

interface LoadingStore {
  isLoading: boolean;
  message: string;
}

let state: LoadingStore = {
  isLoading: false,
  message: '',
};

const listeners = new Set<Listener>();

export const useLoadingStore = {
  getState: () => state,
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  showLoading: (msg = 'Loading...') => {
    state = { isLoading: true, message: msg };
    listeners.forEach(l => l());
    setTimeout(() => {
      state = { isLoading: false, message: '' };
      listeners.forEach(l => l());
    }, 2000);
  },
  hideLoading: () => {
    state = { isLoading: false, message: '' };
    listeners.forEach(l => l());
  }
};

