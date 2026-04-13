import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export const useKeyboardShortcuts = () => {
  const navigate = useNavigate();

  const shortcuts: ShortcutConfig[] = [
    {
      key: 'h',
      ctrl: true,
      description: 'Go to Home/Dashboard',
      action: () => navigate('/'),
    },
    {
      key: 'e',
      ctrl: true,
      description: 'Go to Elements',
      action: () => navigate('/elements'),
    },
    {
      key: 'r',
      ctrl: true,
      description: 'Go to Review Queue',
      action: () => navigate('/review'),
    },
    {
      key: 'a',
      ctrl: true,
      description: 'Go to Analytics',
      action: () => navigate('/analytics'),
    },
    {
      key: 'p',
      ctrl: true,
      description: 'Go to Prompts',
      action: () => navigate('/prompts'),
    },
    {
      key: '/',
      ctrl: true,
      description: 'Show keyboard shortcuts',
      action: () => {
        const shortcutList = shortcuts
          .map(s => `${s.ctrl ? 'Ctrl+' : ''}${s.shift ? 'Shift+' : ''}${s.alt ? 'Alt+' : ''}${s.key.toUpperCase()}: ${s.description}`)
          .join('\n');
        alert(`Keyboard Shortcuts:\n\n${shortcutList}`);
      },
    },
  ];

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Skip if user is typing in an input field
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    const shortcut = shortcuts.find(s => {
      const keyMatch = s.key.toLowerCase() === event.key.toLowerCase();
      const ctrlMatch = s.ctrl === undefined || s.ctrl === (event.ctrlKey || event.metaKey);
      const shiftMatch = s.shift === undefined || s.shift === event.shiftKey;
      const altMatch = s.alt === undefined || s.alt === event.altKey;
      return keyMatch && ctrlMatch && shiftMatch && altMatch;
    });

    if (shortcut) {
      event.preventDefault();
      shortcut.action();
    }
  }, [navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { shortcuts };
};
