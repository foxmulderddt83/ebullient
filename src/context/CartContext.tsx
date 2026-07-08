import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  original_price?: number;
  promotion_end_at?: string;
  quantity: number;
  image_url?: string;
  parentPackageId?: string;
  sort_order?: number;
  category_id?: string;
  category_name?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string, sortOrder?: number) => void;
  updateQuantity: (id: string, quantity: number, sortOrder?: number) => void;
  clearCart: () => void;
  total: number;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch (e) {
        console.error('Failed to parse cart', e);
      }
    }
  }, []);

  // Save cart to localStorage on change
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id && i.sort_order === item.sort_order);
      if (existing) {
        return prev.map(i => (i.id === item.id && i.sort_order === item.sort_order) ? { ...i, ...item, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((id: string, sortOrder?: number) => {
    setItems(prev => {
      const itemToRemove = prev.find(i => i.id === id && (sortOrder === undefined || i.sort_order === sortOrder));
      if (!itemToRemove) return prev;

      // Logic: if we remove a sort_order 0 item, we must also remove sort_order 1 items with same id
      // OR if we have parentPackageId linked, we remove those too.
      if (itemToRemove.sort_order === 0) {
        return prev.filter(i => {
          // Keep if it's not the item itself and not its child with same ID
          const isTargetItem = i.id === id && i.sort_order === 0;
          const isChildWithSameId = i.id === id && i.sort_order === 1;
          const isExplicitChild = i.parentPackageId === id;
          const isImplicitChild = !i.parentPackageId && i.category_id && itemToRemove.category_id && i.category_id === itemToRemove.category_id && i.sort_order === 1;
          
          return !isTargetItem && !isChildWithSameId && !isExplicitChild && !isImplicitChild;
        });
      }

      // If it's a sort_order 1 item or any other item, just remove it
      return prev.filter(i => !(i.id === id && (sortOrder === undefined || i.sort_order === sortOrder)));
    });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number, sortOrder?: number) => {
    if (quantity < 1) {
      removeItem(id, sortOrder);
      return;
    }
    setItems(prev => prev.map(i => (i.id === id && (sortOrder === undefined || i.sort_order === sortOrder)) ? { ...i, quantity } : i));
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, total, isOpen, setIsOpen }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
