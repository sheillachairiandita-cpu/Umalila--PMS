import React, { useState, useEffect, useMemo } from 'react';
import { X, ShoppingCart, Plus, Minus, Trash2, ChefHat, Coffee, UtensilsCrossed, CheckCircle, ClipboardList } from 'lucide-react';
import { Modal } from '../ui';
import { useMutation } from '../../context/MutationProvider';

// ─── category meta ────────────────────────────────────────────
const CATEGORY_META = {
  food:     { label: 'Food',     icon: UtensilsCrossed, color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  beverage: { label: 'Beverage', icon: Coffee,          color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
  snack:    { label: 'Snack',    icon: ChefHat,         color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  dessert:  { label: 'Dessert',  icon: ChefHat,         color: '#be185d', bg: '#fdf2f8', border: '#fbcfe8' },
  partner_kitchen:  { label: 'Partner Kitchen',  icon: ChefHat,         color: '#bc6c8d', bg: '#fdf2f8', border: '#fbcfe8' },
  other:    { label: 'Other',    icon: ChefHat,         color: '#374151', bg: '#f9fafb', border: '#e5e7eb' },
};

// ─── Qty stepper ──────────────────────────────────────────────
function QtyStepper({ qty, onIncrease, onDecrease }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '20px', padding: '2px' }}>
      <button
        onClick={onDecrease}
        style={{
          border: 'none', background: 'none', width: '24px', height: '24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#64748b', transition: 'all 0.1s'
        }}
      >
        <Minus size={12} strokeWidth={2.5} />
      </button>
      <span style={{ minWidth: '20px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
        {qty}
      </span>
      <button
        onClick={onIncrease}
        style={{
          border: 'none', background: 'none', width: '24px', height: '24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#1e3a8a', transition: 'all 0.1s'
        }}
      >
        <Plus size={12} strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────
function OrderModal({ isOpen, booking, onClose, onOrderSaved }) {
  const { runMutation } = useMutation();
  const [tab, setTab] = useState('menu'); // 'menu' | 'cart' | 'history'
  const [menuItems, setMenuItems] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cart state: { [itemId]: { item, qty, variant, notes } }
  const [cart, setCart] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // History state
  const [ordersHistory, setOrdersHistory] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Load menu items once modal opens
  useEffect(() => {
    if (isOpen) {
      fetchMenu();
      fetchOrderHistory();
      setTab('menu');
      setCart({});
      setError(null);
    }
  }, [isOpen, booking]);

  const fetchMenu = async () => {
    setLoadingMenu(true);
    try {
      const response = await fetch('/api/menu-items');
      if (!response.ok) throw new Error('Failed to fetch menu items');
      const data = await response.json();
      setMenuItems(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMenu(false);
    }
  };

  const fetchOrderHistory = async () => {
    if (!booking?.id) return;
    try {
      // FIX: Changed from /orders to /food-orders to match your backend formatter
      const response = await fetch(`/api/bookings/${booking.id}/food-orders`);
      if (!response.ok) throw new Error('Failed to fetch order history');
      const data = await response.json();
      setOrdersHistory(data);
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  // Filtered menu
  const filteredMenu = useMemo(() => {
    return menuItems.filter(item => {
      const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Cart calculations
  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartCount = useMemo(() => cartItems.reduce((acc, curr) => acc + curr.qty, 0), [cartItems]);
  const cartTotal = useMemo(() => cartItems.reduce((acc, curr) => acc + (curr.item.price * curr.qty), 0), [cartItems]);

  const updateQty = (item, delta) => {
    setCart(prev => {
      const current = prev[item.id];
      if (!current && delta < 0) return prev;
      
      const next = { ...prev };
      if (!current && delta > 0) {
        next[item.id] = { item, qty: 1, notes: '' };
      } else {
        const nextQty = current.qty + delta;
        if (nextQty <= 0) {
          delete next[item.id];
        } else {
          next[item.id] = { ...current, qty: nextQty };
        }
      }
      return next;
    });
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0 || !booking?.id) return;
    setSubmitting(true);
    setError(null);

    const result = await runMutation({
      mutation: async () => {
        const itemsPayload = cartItems.map(c => ({
          menu_item_id: c.item.id,
          quantity: c.qty,
          price_at_order: c.item.price,
          notes: c.notes || ''
        }));

        const response = await fetch(`/api/bookings/${booking.id}/food-orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsPayload }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to submit order to server.');
        }

        return response.json();
      },
      refresh: async () => {
        if (typeof onOrderSaved === 'function') {
          await onOrderSaved();
        }
        await fetchOrderHistory();
      },
      successMessage: 'Food order placed successfully.',
      overlayMessage: 'Placing order…',
    });

    setSubmitting(false);

    if (result.ok) {
      setCart({});
      setTab('history');
    } else {
      setError(result.error?.message || 'Failed to submit order');
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      {/* Dynamic structural container fixing layout tag mismatches */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '80vh', background: '#fff' }}>
        
        {/* ── HEADER CONTAINER ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>In-House Food Order</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Booking #{booking?.id?.substring(0,8) || '—'} — {booking?.guests?.full_name || 'Guest'} ({booking?.property_names || '—'})
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={18} />
          </button>
        </div>

        {/* ── TABS NAVIGATION ── */}
        <div style={{ display: 'flex', padding: '0 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', gap: '16px' }}>
          {[
            { key: 'menu', label: 'Menu List', icon: ChefHat },
            { key: 'cart', label: `Cart (${cartCount})`, icon: ShoppingCart },
            { key: 'history', label: 'Order History', icon: ClipboardList }
          ].map(t => {
            const isSel = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '12px 4px', border: 'none', background: 'none',
                  borderBottom: isSel ? '2px solid #1e3a8a' : '2px solid transparent',
                  color: isSel ? '#1e3a8a' : '#64748b',
                  fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.1s'
                }}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{ padding: '10px 24px', background: '#fef2f2', color: '#b91c1c', fontSize: '0.8rem', borderBottom: '1px solid #fee2e2' }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── TAB CONTENT SCAFFOLDS ── */}
        
        {/* ── MENU LIST TAB ── */}
        {tab === 'menu' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Menu Filters Frame */}
            <div style={{ padding: '14px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '12px', alignItems: 'center', background: '#fff' }}>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#475569', fontWeight: 500 }}
              >
                <option value="all">All Categories</option>
                <option value="food">Food</option>
                <option value="beverage">Beverages</option>
                <option value="snack">Snacks</option>
                <option value="dessert">Dessert</option>
                <option value="other">Other</option>
              </select>

              <input
                type="text"
                placeholder="Search menu..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}
              />
            </div>

            {/* Menu Container Scroller */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#f8fafc' }}>
              {loadingMenu ? (
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading items...</div>
              ) : filteredMenu.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', marginTop: '20px' }}>No items found.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
                  {filteredMenu.map(item => {
                    const meta = CATEGORY_META[item.category] || CATEGORY_META.other;
                    const inCart = cart[item.id];
                    return (
                      <div key={item.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'between', position: 'relative' }}>
                        <div>
                          <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', borderRadius: '10px', background: meta.bg, color: meta.color, textTransform: 'uppercase' }}>
                            {meta.label}
                          </span>
                          <h4 style={{ margin: '8px 0 2px 0', fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>{item.name}</h4>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e3a8a', marginBottom: '8px' }}>
                            Rp {item.price?.toLocaleString('id-ID')}
                          </div>
                        </div>

                        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                          {inCart ? (
                            <QtyStepper
                              qty={inCart.qty}
                              onIncrease={() => updateQty(item, 1)}
                              onDecrease={() => updateQty(item, -1)}
                            />
                          ) : (
                            <button
                              onClick={() => updateQty(item, 1)}
                              style={{ padding: '4px 10px', borderRadius: '20px', border: '1px solid #1e3a8a', background: 'none', color: '#1e3a8a', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CART PREVIEW TAB ── */}
        {tab === 'cart' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {cartItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: '0.85rem' }}>Your cart is empty. Go add some delicious food!</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {cartItems.map(c => (
                    <div key={c.item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: '16px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>{c.item.name}</h4>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Rp {c.item.price?.toLocaleString('id-ID')}</div>
                        <input
                          type="text"
                          placeholder="Add cooking notes (e.g., non-spicy)..."
                          value={c.notes || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setCart(prev => ({ ...prev, [c.item.id]: { ...prev[c.item.id], notes: val } }));
                          }}
                          style={{ width: '100%', maxWidth: '300px', border: 'none', borderBottom: '1px dashed #cbd5e1', fontSize: '0.75rem', padding: '4px 0', marginTop: '6px', color: '#475569', outline: 'none' }}
                        />
                      </div>
                      <QtyStepper
                        qty={c.qty}
                        onIncrease={() => updateQty(c.item, 1)}
                        onDecrease={() => updateQty(c.item, -1)}
                      />
                      <div style={{ textAlign: 'right', minWidth: '80px', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                        Rp {(c.item.price * c.qty).toLocaleString('id-ID')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Sticky Receipt Footer */}
            {cartItems.length > 0 && (
              <div style={{ padding: '20px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Order:</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e3a8a' }}>Rp {cartTotal.toLocaleString('id-ID')}</div>
                </div>
                <button
                  onClick={handlePlaceOrder}
                  disabled={submitting || cartItems.length === 0}
                  style={{
                    padding: '10px 20px', borderRadius: '8px', border: 'none',
                    background: cartItems.length === 0 ? '#e2e8f0' : '#0f172a',
                    color: cartItems.length === 0 ? '#94a3b8' : '#fff',
                    fontSize: '0.85rem', fontWeight: 700,
                    cursor: cartItems.length === 0 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}
                >
                  {submitting ? 'Saving…' : (
                    <><ShoppingCart size={14} /> Place Order</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {loadingOrders ? (
              <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading order history…</div>
            ) : ordersHistory.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', marginTop: '20px' }}>No previous orders logged for this stay.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {ordersHistory.map((order, idx) => (
                  <div key={order.id || idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Order Reference #{order.id?.substring(0,6) || idx + 1}</span>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{order.created_at || 'Just Now'}</span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {order.items?.map((it, itemIdx) => (
                        <div key={itemIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ color: '#0f172a' }}>{it.menu_item_name} <b style={{ color: '#64748b' }}>x{it.quantity}</b></span>
                          <span style={{ color: '#475569', fontWeight: 500 }}>Rp {(it.price_at_order * it.quantity).toLocaleString('id-ID')}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={12} /> Logged to Folio
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                        Rp {order.total_price?.toLocaleString('id-ID') || '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </Modal>
  );
}

export default OrderModal;