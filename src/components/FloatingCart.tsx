import React, { useMemo } from 'react';
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { ShoppingCart, Trash2, Plus, Minus, CornerDownRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export const FloatingCart = () => {
  const { items, removeItem, updateQuantity, total, isOpen, setIsOpen } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const { allDisplayItems, hasMultiplePackages } = useMemo(() => {
    // Identify Main Packages (sort_order 0 or undefined, and no parentPackageId)
    const mainPackages = items.filter(i => (i.sort_order === 0 || i.sort_order === undefined) && !i.parentPackageId);
    
    // Identify Add-ons (sort_order > 0 or has parentPackageId)
    const addons = items.filter(i => (i.sort_order && i.sort_order > 0) || i.parentPackageId);
    
    const assignedAddonIds = new Set<string>();
    
    // Map addons to their parents
    const grouped = mainPackages.map(parent => {
      const children = addons.filter(addon => {
        if (assignedAddonIds.has(addon.id)) return false;
        
        // Match explicit parent
        if (addon.parentPackageId === parent.id) {
          assignedAddonIds.add(addon.id);
          return true;
        }
        
        // Match implicit category (if no explicit parent)
        if (!addon.parentPackageId && 
            addon.category_id && 
            parent.category_id && 
            addon.category_id === parent.category_id) {
          assignedAddonIds.add(addon.id);
          return true;
        }
        
        return false;
      });
      return { ...parent, children };
    });
    
    // Find orphans (addons that didn't match any parent)
    const orphans = addons.filter(addon => !assignedAddonIds.has(addon.id));
    
    return { 
      allDisplayItems: [
        ...grouped, 
        ...orphans.map(o => ({ ...o, children: [] as typeof items }))
      ],
      hasMultiplePackages: mainPackages.length > 1
    };
  }, [items]);

  // Pages that embed the booking wizard, and so need the cart alongside it.
  const CART_ROUTES = ["/", "/packages"];
  if (items.length === 0 || !CART_ROUTES.includes(location.pathname)) return null;

  return (
    <div className="fixed bottom-24 right-6 z-50">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button 
            size="lg" 
            className="rounded-full h-9 w-9 md:h-12 md:w-12 transition-all duration-300 hover:scale-110 active:scale-95 group border border-black bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(var(--primary-rgb),0.5),0_0_40px_rgba(var(--primary-rgb),0.2)]"
          >
            <ShoppingCart className="w-4 h-4 md:w-6 md:h-6 text-primary-foreground group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground rounded-full w-3.5 h-3.5 md:w-5 md:h-5 flex items-center justify-center text-[8px] md:text-[10px] font-bold border-2 border-background shadow-lg z-10">
              {items.reduce((acc, item) => acc + item.quantity, 0)}
            </span>
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 z-20">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white border-2 border-primary"></span>
            </span>
            <span className="absolute inset-0 rounded-full border-2 border-white/30 animate-pulse pointer-events-none" />
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[300px] sm:w-[400px] flex flex-col p-4 md:p-6">
          <SheetHeader className="mb-2 md:mb-4">
            <SheetTitle className="flex items-center gap-2 text-base md:text-lg">
              <ShoppingCart className="w-4 h-4 md:w-5 md:h-5" /> Your Cart
            </SheetTitle>
          </SheetHeader>
          
          <ScrollArea className="flex-1 -mx-4 px-4 md:-mx-6 md:px-6 my-2 md:my-4">
            <div className="space-y-4">
              <AnimatePresence>
                {allDisplayItems.map((rootItem) => (
                  <React.Fragment key={rootItem.id}>
                    {/* Main Item */}
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="flex gap-4 py-4 border-b border-black"
                    >
                      {rootItem.image_url && (
                        <motion.img 
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          src={rootItem.image_url} 
                          alt={rootItem.name} 
                          className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded-md" 
                        />
                      )}
                      <div className="flex-1">
                        <div className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-[#CC1F1F]/60 mb-0.5">{rootItem.category_name || "Package"}</div>
                        <h4 className="font-bold text-xs md:text-sm line-clamp-2 uppercase">{rootItem.name}</h4>
                        <p className="text-xs md:text-sm font-bold text-primary mt-1">RM {rootItem.price}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Button variant="secondary" size="icon" className="h-5 w-5 md:h-6 md:w-6 border-slate-200 shadow-sm" onClick={() => updateQuantity(rootItem.id, rootItem.quantity - 1, rootItem.sort_order)}>
                            <Minus className="w-2.5 h-2.5 md:w-3 md:h-3" />
                          </Button>
                          <span className="text-xs md:text-sm w-4 text-center">{rootItem.quantity}</span>
                          <Button variant="secondary" size="icon" className="h-5 w-5 md:h-6 md:w-6 border-slate-200 shadow-sm" onClick={() => updateQuantity(rootItem.id, rootItem.quantity + 1, rootItem.sort_order)}>
                            <Plus className="w-2.5 h-2.5 md:w-3 md:h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 md:h-6 md:w-6 ml-auto text-muted-foreground hover:text-destructive" onClick={() => removeItem(rootItem.id, rootItem.sort_order)}>
                            <Trash2 className="w-2.5 h-2.5 md:w-3 md:h-3" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>

                    {/* Add-ons for this main item */}
                    {rootItem.children.map((addon) => (
                        <motion.div 
                          key={addon.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex gap-3 py-2 pl-8 border-b border-dashed border-black bg-slate-50/50"
                        >
                          <CornerDownRight className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                          {addon.image_url && (
                            <motion.img 
                              initial={{ scale: 0.8 }}
                              animate={{ scale: 1 }}
                              src={addon.image_url} 
                              alt={addon.name} 
                              className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-md shrink-0" 
                            />
                          )}
                          <div className="flex-1">
                            <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{addon.category_name || "Add-on"}</div>
                            <h5 className="text-xs font-medium text-slate-600">{addon.name}</h5>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-xs font-bold text-primary">RM {addon.price}</p>
                              <div className="flex items-center gap-2">
                                <Button variant="secondary" size="icon" className="h-5 w-5 border-slate-200 shadow-sm" onClick={() => updateQuantity(addon.id, addon.quantity - 1, addon.sort_order)}>
                                  <Minus className="w-2.5 h-2.5" />
                                </Button>
                                <span className="text-[10px] text-slate-600 w-3 text-center">{addon.quantity}</span>
                                <Button variant="secondary" size="icon" className="h-5 w-5 border-slate-200 shadow-sm" onClick={() => updateQuantity(addon.id, addon.quantity + 1, addon.sort_order)}>
                                  <Plus className="w-2.5 h-2.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 text-muted-foreground hover:text-destructive" onClick={() => removeItem(addon.id, addon.sort_order)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                  </React.Fragment>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>

          <div className="space-y-4 pt-4 border-t">
            {hasMultiplePackages && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                <p className="text-xs text-red-600 font-bold text-center">
                  Only one main package allowed per booking. Please remove one to proceed.
                </p>
              </div>
            )}
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Total</span>
              <span>RM {total.toFixed(2)}</span>
            </div>
            <SheetFooter>
              <Button 
                className={`w-full font-bold h-12 ${hasMultiplePackages ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'} text-white`} 
                size="lg" 
                disabled={hasMultiplePackages}
                onClick={() => { 
                setIsOpen(false); 
                // Ensure we are on Step 2 (Passenger Info)
                const bookingWizardElement = document.getElementById('booking');
                if (bookingWizardElement) {
                  // Dispatch a custom event that BookingWizard can listen to
                  window.dispatchEvent(new CustomEvent('goToPassengerInfo'));
                  bookingWizardElement.scrollIntoView({ behavior: 'smooth' });
                } else {
                  // If not on home page, go home first
                  navigate('/#booking');
                  localStorage.setItem('forceBookingStep', '2');
                }
              }}>
                {hasMultiplePackages ? 'Multiple Packages Detected' : 'Checkout'}
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
