# Reusable Component System - Implementation Guide

## Overview
I've created a comprehensive, centralized design system for your PMS application. This makes it easy to maintain consistent styling and reuse components across your entire app.

## New Files Created

### 1. **Design System** (`src/styles/theme.js`)
Centralized color palette, spacing, typography, and component styles.

**Key Exports:**
- `COLORS` - All color definitions (primary, success, danger, etc.)
- `SPACING` - Standardized spacing (xs, sm, md, lg, xl, xxl)
- `BORDER_RADIUS` - Border radius values
- `TYPOGRAPHY` - Typography scales (h1, h2, body, label, etc.)
- `SHADOWS` - Box shadow definitions
- `TRANSITIONS` - Animation timing
- `BUTTON_VARIANTS` - Pre-defined button styles
- `INPUT_BASE` - Base input styling
- `MODAL_BASE` - Modal container styles

**Usage:**
```javascript
import { COLORS, SPACING, TYPOGRAPHY } from '../styles/theme';

<div style={{ color: COLORS.primary, padding: SPACING.lg }}>
  {content}
</div>
```

### 2. **Utility Helpers** (`src/styles/styleUtils.js`)
Helper functions for creating and managing styles dynamically.

**Key Functions:**
- `getButtonStyles(variant, disabled)` - Generate button styles
- `getStatusBadgeStyles(config)` - Style status badges
- `getInputStyles(error, focused)` - Dynamic input styles
- `getFlexStyles(direction, align, justify, gap)` - Flex layouts
- `getGridStyles(columns, gap)` - Grid layouts
- `mergeStyles(...styles)` - Merge style objects
- `cn()` / `classNames()` - Combine class names

**Usage:**
```javascript
import { getButtonStyles, cn } from '../styles/styleUtils';

const btnStyle = getButtonStyles('primary', false);
const className = cn('btn', isActive && 'active');
```

## New Reusable UI Components

### 1. **Button** (`src/components/ui/Button.jsx`)
Flexible button component with multiple variants and sizes.

**Variants:** primary, success, secondary, danger, ghost
**Sizes:** sm, md, lg
**Features:** Loading state, disabled state, icon support, full width

```javascript
import { Button } from './ui';

<Button variant="success" size="md" onClick={handleClick}>
  Save Changes
</Button>

<Button variant="danger" disabled loading={isSubmitting}>
  {isSubmitting ? 'Deleting...' : 'Delete'}
</Button>
```

### 2. **Input** (`src/components/ui/Input.jsx`)
Text input with label, validation, error states, and help text.

**Features:** Required indicator, error messages, help text, disabled state, focus styles

```javascript
import { Input } from './ui';

<Input
  label="Email"
  type="email"
  placeholder="user@example.com"
  value={email}
  onChange={handleChange}
  error={emailError}
  required
/>
```

### 3. **Select** (`src/components/ui/Select.jsx`)
Dropdown select with consistent styling.

```javascript
import { Select } from './ui';

<Select
  label="Category"
  options={[
    { value: 'food', label: 'Food' },
    { value: 'beverage', label: 'Beverage' }
  ]}
  value={selected}
  onChange={handleSelect}
/>
```

### 4. **Modal** (`src/components/ui/Modal.jsx`)
Reusable modal container with Header, Body, and Footer components.

**Sizes:** sm, md, lg, xl

```javascript
import { Modal, Button } from './ui';

<Modal isOpen={isOpen} onClose={handleClose} size="md">
  <Modal.Header
    title="Confirm Delete"
    icon={AlertIcon}
    onClose={handleClose}
  />
  
  <Modal.Body>
    <p>Are you sure you want to delete this item?</p>
  </Modal.Body>
  
  <Modal.Footer align="flex-end">
    <Button variant="secondary" onClick={handleClose}>Cancel</Button>
    <Button variant="danger" onClick={handleDelete}>Delete</Button>
  </Modal.Footer>
</Modal>
```

### 5. **Card** (`src/components/ui/Card.jsx`)
Reusable card container with optional Header, Body, and Footer.

**Variants:** default, elevated, flat

```javascript
import { Card } from './ui';

<Card variant="elevated">
  <Card.Header
    title="Card Title"
    subtitle="Optional subtitle"
    action={<Button size="sm">Action</Button>}
  />
  
  <Card.Body padding="lg">
    Card content goes here
  </Card.Body>
  
  <Card.Footer align="flex-end">
    <Button>Save</Button>
  </Card.Footer>
</Card>
```

### 6. **Alert** (`src/components/ui/Alert.jsx`)
Reusable alert/notification component.

**Types:** error, success, warning, info

```javascript
import { Alert } from './ui';

<Alert
  type="error"
  title="Error Occurred"
  message="Something went wrong. Please try again."
  onClose={handleClose}
/>

<Alert type="success" message="Operation completed successfully" />
```

## Index File

### `src/components/ui/index.js`
Centralized export for all UI components.

```javascript
export { default as Alert } from './Alert';
export { default as Badge } from './Badge';
export { default as Button } from './Button';
export { default as Card } from './Card';
export { default as Input } from './Input';
export { default as Modal } from './Modal';
export { default as Select } from './Select';
```

**Usage:**
```javascript
import { Button, Card, Input, Modal } from './ui';
```

## Migration Guide

### Before (Old Way)
```javascript
import { X, DollarSign } from 'lucide-react';

<div style={{
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
}}>
  <div style={{
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    maxWidth: 500,
    width: '90%',
    padding: 24
  }}>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 24,
      paddingBottom: 16,
      borderBottom: '1px solid #e2e8f0'
    }}>
      <h2>{title}</h2>
      <button onClick={onClose}><X size={20} /></button>
    </div>
    {/* content */}
  </div>
</div>

<button style={{
  padding: '10px 16px',
  background: '#059669',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontWeight: 600,
  cursor: 'pointer'
}}>
  Save
</button>
```

### After (New Way)
```javascript
import { Modal, Button } from './ui';
import { DollarSign } from 'lucide-react';

<Modal isOpen={isOpen} onClose={onClose}>
  <Modal.Header title={title} icon={DollarSign} onClose={onClose} />
  <Modal.Body>{content}</Modal.Body>
  <Modal.Footer>
    <Button variant="success">Save</Button>
  </Modal.Footer>
</Modal>
```

## Styling Best Practices

1. **Use theme values for colors:**
   ```javascript
   // ✅ Good
   style={{ color: COLORS.primary }}
   
   // ❌ Avoid
   style={{ color: '#1e3a8a' }}
   ```

2. **Use spacing constants:**
   ```javascript
   // ✅ Good
   style={{ padding: SPACING.lg, marginBottom: SPACING.md }}
   
   // ❌ Avoid
   style={{ padding: '16px', marginBottom: '12px' }}
   ```

3. **Use variant-based components:**
   ```javascript
   // ✅ Good
   <Button variant="success" size="md">Save</Button>
   
   // ❌ Avoid
   <button style={{ background: '#059669', padding: '8px 12px' }}>Save</button>
   ```

4. **Compose components:**
   ```javascript
   // ✅ Good
   <Modal>
     <Modal.Header />
     <Modal.Body />
     <Modal.Footer />
   </Modal>
   
   // ❌ Avoid
   <div style={{...}} className="modal">
     <div className="modal-header" />
     <div className="modal-body" />
   </div>
   ```

## Next Steps

1. Update remaining components to use the new system:
   - `OperationsTable.jsx` - Use Button, Card, Modal
   - `OrderModal.jsx` - Use Modal, Input, Button
   - `DashboardStats.jsx` - Use Card
   - `PublicReservationForm.jsx` - Use Input, Select, Button
   - `ReservationDetailsModal.jsx` - Use Modal, Card

2. All existing style objects can be replaced with theme values

3. For complex styling, use styleUtils helper functions

4. Keep CSS classes in sync with Tailwind/theme colors for consistency

## Benefits

✅ **Consistency** - Same colors, spacing, and styling everywhere
✅ **Maintainability** - Change colors/spacing in one place
✅ **Reusability** - Components work across the entire app
✅ **Performance** - Fewer inline styles, easier to optimize
✅ **DX** - Easy to use, less code to write
✅ **Scalability** - Easy to add new variants and sizes
