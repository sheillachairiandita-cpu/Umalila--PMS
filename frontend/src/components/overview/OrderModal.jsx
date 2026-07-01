import React, { useState, useEffect, useMemo } from 'react';
import { X, ShoppingCart, Plus, Minus, ChefHat, Coffee, UtensilsCrossed, CheckCircle, ClipboardList } from 'lucide-react';
import { Modal } from '../ui';
import { useMutation } from '../../context/MutationProvider';

const CATEGORY_META = {
  food:     { label: 'Food',     icon: UtensilsCrossed, color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  beverage: { label: 'Beverage', icon: Coffee,          color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
  snack:    { label: 'Snack',    icon: ChefHat,         color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  dessert:  { label: 'Dessert',  icon: ChefHat,         color: '#be185d', bg: '#fdf2f8', border: '#fbcfe8' },
  partner_kitchen:  { label: 'Partner Kitchen',  icon: ChefHat,         color: '#bc6c8d', bg: '#fdf2f8', border: '#fbcfe8' },
  other:    { label: 'Other',    icon: ChefHat,         color: '#374151', bg: '#f9fafb', border: '#e5e7eb' },
};

function QtyStepper({ qty, onIncrease, onDecrease }) {
  return (
    <div className="order-modal__qty-stepper">
      <button type="button" className="order-modal__qty-btn" onClick={onDecrease} aria-label="Decrease quantity">
        <Minus size={12} strokeWidth={2.5} />
      </button>
      <span className="order-modal__qty-value">{qty}</span>
      <button type="button" className="order-modal__qty-btn order-modal__qty-btn--add" onClick={onIncrease} aria-label="Increase quantity">
        <Plus size={12} strokeWidth={2.5} />
      </button>
    </div>
  );
}

function OrderModal({ isOpen, booking, onClose, onOrderSaved }) {
  const { runMutation } = useMutation();
  const [tab, setTab] = useState('menu');
  const [menuItems, setMenuItems] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [ordersHistory, setOrdersHistory] = useState([]);

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
      const response = await fetch(`/api/bookings/${booking.id}/food-orders`);
      if (!response.ok) throw new Error('Failed to fetch order history');
      const data = await response.json();
      setOrdersHistory(data);
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  const filteredMenu = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartCount = useMemo(() => cartItems.reduce((acc, curr) => acc + curr.qty, 0), [cartItems]);
  const cartTotal = useMemo(() => cartItems.reduce((acc, curr) => acc + (curr.item.price * curr.qty), 0), [cartItems]);

  const updateQty = (item, delta) => {
    setCart((prev) => {
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
        const itemsPayload = cartItems.map((c) => ({
          menu_item_id: c.item.id,
          quantity: c.qty,
          price_at_order: c.item.price,
          notes: c.notes || '',
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
    <Modal isOpen={isOpen} onClose={onClose} size="lg" className="order-modal-overlay">
      <div className="order-modal">
        <div className="order-modal__header">
          <div className="order-modal__header-text">
            <h3 className="order-modal__title">In-House Food Order</h3>
            <p className="order-modal__subtitle">
              Booking #{booking?.id?.substring(0, 8) || '—'} — {booking?.guests?.full_name || 'Guest'} ({booking?.property_names || '—'})
            </p>
          </div>
          <button type="button" className="order-modal__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="order-modal__tabs" role="tablist">
          {[
            { key: 'menu', label: 'Menu List', icon: ChefHat },
            { key: 'cart', label: `Cart (${cartCount})`, icon: ShoppingCart },
            { key: 'history', label: 'Order History', icon: ClipboardList },
          ].map((t) => {
            const isSel = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isSel}
                className={`order-modal__tab${isSel ? ' order-modal__tab--active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="order-modal__error" role="alert">
            {error}
          </div>
        )}

        {tab === 'menu' && (
          <div className="order-modal__panel">
            <div className="order-modal__filters">
              <select
                className="order-modal__select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                <option value="food">Food</option>
                <option value="beverage">Beverages</option>
                <option value="snack">Snacks</option>
                <option value="dessert">Dessert</option>
                <option value="other">Other</option>
              </select>
              <input
                type="search"
                className="order-modal__search"
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="order-modal__scroll">
              {loadingMenu ? (
                <div className="order-modal__empty">Loading items...</div>
              ) : filteredMenu.length === 0 ? (
                <div className="order-modal__empty order-modal__empty--center">No items found.</div>
              ) : (
                <div className="order-modal__menu-grid">
                  {filteredMenu.map((item) => {
                    const meta = CATEGORY_META[item.category] || CATEGORY_META.other;
                    const inCart = cart[item.id];
                    return (
                      <div key={item.id} className="order-modal__menu-card">
                        <div>
                          <span
                            className="order-modal__category-badge"
                            style={{ background: meta.bg, color: meta.color }}
                          >
                            {meta.label}
                          </span>
                          <h4 className="order-modal__item-name">{item.name}</h4>
                          <div className="order-modal__item-price">
                            Rp {item.price?.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="order-modal__item-actions">
                          {inCart ? (
                            <QtyStepper
                              qty={inCart.qty}
                              onIncrease={() => updateQty(item, 1)}
                              onDecrease={() => updateQty(item, -1)}
                            />
                          ) : (
                            <button
                              type="button"
                              className="order-modal__add-btn"
                              onClick={() => updateQty(item, 1)}
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

        {tab === 'cart' && (
          <div className="order-modal__panel order-modal__panel--cart">
            <div className="order-modal__scroll order-modal__scroll--padded">
              {cartItems.length === 0 ? (
                <div className="order-modal__empty order-modal__empty--center">
                  Your cart is empty. Go add some delicious food!
                </div>
              ) : (
                <div className="order-modal__cart-list">
                  {cartItems.map((c) => (
                    <div key={c.item.id} className="order-modal__cart-row">
                      <div className="order-modal__cart-info">
                        <h4 className="order-modal__item-name">{c.item.name}</h4>
                        <div className="order-modal__cart-unit-price">
                          Rp {c.item.price?.toLocaleString('id-ID')}
                        </div>
                        <input
                          type="text"
                          className="order-modal__notes-input"
                          placeholder="Add cooking notes (e.g., non-spicy)..."
                          value={c.notes || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCart((prev) => ({ ...prev, [c.item.id]: { ...prev[c.item.id], notes: val } }));
                          }}
                        />
                      </div>
                      <QtyStepper
                        qty={c.qty}
                        onIncrease={() => updateQty(c.item, 1)}
                        onDecrease={() => updateQty(c.item, -1)}
                      />
                      <div className="order-modal__cart-line-total">
                        Rp {(c.item.price * c.qty).toLocaleString('id-ID')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="order-modal__cart-footer">
                <div>
                  <span className="order-modal__total-label">Total Order:</span>
                  <div className="order-modal__total-value">Rp {cartTotal.toLocaleString('id-ID')}</div>
                </div>
                <button
                  type="button"
                  className="order-modal__place-btn"
                  onClick={handlePlaceOrder}
                  disabled={submitting || cartItems.length === 0}
                >
                  {submitting ? 'Saving…' : (
                    <>
                      <ShoppingCart size={14} />
                      Place Order
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="order-modal__scroll order-modal__scroll--padded">
            {ordersHistory.length === 0 ? (
              <div className="order-modal__empty order-modal__empty--center">
                No previous orders logged for this stay.
              </div>
            ) : (
              <div className="order-modal__history-list">
                {ordersHistory.map((order, idx) => (
                  <div key={order.id || idx} className="order-modal__history-card">
                    <div className="order-modal__history-header">
                      <span className="order-modal__history-ref">
                        Order Reference #{order.id?.substring(0, 6) || idx + 1}
                      </span>
                      <span className="order-modal__history-date">{order.created_at || 'Just Now'}</span>
                    </div>
                    <div className="order-modal__history-items">
                      {order.items?.map((it, itemIdx) => (
                        <div key={itemIdx} className="order-modal__history-line">
                          <span>
                            {it.menu_item_name}
                            {' '}
                            <b>x{it.quantity}</b>
                          </span>
                          <span>Rp {(it.price_at_order * it.quantity).toLocaleString('id-ID')}</span>
                        </div>
                      ))}
                    </div>
                    <div className="order-modal__history-footer">
                      <span className="order-modal__history-status">
                        <CheckCircle size={12} />
                        Logged to Folio
                      </span>
                      <span className="order-modal__history-total">
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
