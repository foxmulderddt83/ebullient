# Flying Club Booking Flow - Visual Guide

## 🛫 BOOKING FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                         LANDING PAGE                             │
│                                                                   │
│                    [START BOOKING] Button                        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   STEP 1: FLIGHT UPGRADES                        │
│  Progress: [████░░░░] 25%                     Cart: RM 0 (0) 🛒  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │ Extended Flight Time │  │ Additional Passenger │            │
│  │     (+30 Mins)       │  │                      │            │
│  │      RM 900          │  │       RM 200         │            │
│  │  [Add] [Skip]        │  │   [Add] [Skip]       │            │
│  └──────────────────────┘  └──────────────────────┘            │
│                                                                   │
│                         [Continue →]                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ (If Extended Flight selected)
                          ├──→ POPUP SUGGESTION ━━━━━┐
                          │                           │
                          │   ┌──────────────────────────────┐
                          │   │ 💡 Suggested for You!        │
                          │   │                               │
                          │   │ Capture your extended flight  │
                          │   │ with Sky Moments Video!       │
                          │   │          RM 350               │
                          │   │                               │
                          │   │  [Add to Cart] [Maybe Later]  │
                          │   └──────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                STEP 2: LOGISTICS & OTHERS                        │
│  Progress: [████████░░] 50%                 Cart: RM 900 (1) 🛒  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │  Hangar Tour Pass    │  │ Luxury Car Transfer  │            │
│  │     (Guest)          │  │   (Round Trip)       │            │
│  │   RM 65/pax          │  │      RM 450          │            │
│  │  [Add] [Skip]        │  │   [Add] [Skip]       │            │
│  └──────────────────────┘  └──────────────────────┘            │
│                                                                   │
│                         [Continue →]                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   STEP 3: VIDEO & MEDIA                          │
│  Progress: [████████████░] 75%           Cart: RM 1,350 (2) 🛒  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │  Highlight Reel      │  │  Go Pro Cockpit      │            │
│  │  (Social Ready)      │  │    Raw Video         │            │
│  │     RM 150           │  │      RM 199          │            │
│  │  [Add] [Skip]        │  │   [Add] [Skip]       │            │
│  └──────────────────────┘  └──────────────────────┘            │
│                                                                   │
│  ┌──────────────────────┐                                       │
│  │  Sky Moments Video   │  ⭐ RECOMMENDED                       │
│  │   (2-min Cinematic)  │                                       │
│  │     RM 350           │                                       │
│  │  [Add] [Skip]        │                                       │
│  └──────────────────────┘                                       │
│                                                                   │
│                         [Continue →]                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STEP 4: CELEBRATION                             │
│  Progress: [████████████████] 100%        Cart: RM 1,500 (3) 🛒  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │ Pilot Uniform Rental │  │  Aviation Theme Cake │            │
│  │      RM 100          │  │       RM 180         │            │
│  │  [Add] [Skip]        │  │   [Add] [Skip]       │            │
│  └──────────────────────┘  └──────────────────────┘            │
│                                                                   │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │ Premium Flower       │  │  Arrival Greeting    │            │
│  │     Bouquet          │  │       Board          │            │
│  │      RM 250          │  │       RM 108         │            │
│  │  [Add] [Skip]        │  │   [Add] [Skip]       │            │
│  └──────────────────────┘  └──────────────────────┘            │
│                                                                   │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │  Grand Landing       │  │ The Sky Celebration  │ 💎 COMBO   │
│  │    Ceremony          │  │   (Full Combo)       │            │
│  │      RM 188          │  │       RM 250         │            │
│  │  [Add] [Skip]        │  │   [Add] [Skip]       │            │
│  └──────────────────────┘  └──────────────────────┘            │
│                                                                   │
│                    [Review Booking →]                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CART REVIEW PAGE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  YOUR BOOKING SUMMARY                                            │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Extended Flight Time (+30 Mins)           RM 900.00    │    │
│  │ Luxury Car Transfer                       RM 450.00    │    │
│  │ Sky Moments Video                         RM 350.00    │    │
│  │                                                          │    │
│  │ Subtotal:                                 RM 1,700.00   │    │
│  │ Tax (0%):                                 RM 0.00       │    │
│  │                                           ─────────────  │    │
│  │ TOTAL:                                    RM 1,700.00   │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Have a promo code? [____________] [Apply]                      │
│                                                                   │
│  [← Edit Cart]               [Proceed to Payment →]             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CUSTOMER DETAILS                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Full Name:     [_________________________]                     │
│  Email:         [_________________________]                     │
│  Phone:         [_________________________]                     │
│  Special Notes: [_________________________]                     │
│                                                                   │
│  ☐ I agree to Terms & Conditions                                │
│                                                                   │
│                    [Proceed to Payment →]                        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CHIP PAYMENT GATEWAY                           │
│                   (External - CHIP Page)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Select Payment Method:                                          │
│  ○ Online Banking (FPX)                                          │
│  ○ Credit/Debit Card                                             │
│  ○ E-Wallet                                                      │
│                                                                   │
│                      [Pay Now]                                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PAYMENT SUCCESS ✓                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  🎉 Booking Confirmed!                                           │
│                                                                   │
│  Booking Reference: FLY-2026-00123                              │
│  Amount Paid: RM 1,700.00                                       │
│                                                                   │
│  Confirmation email sent to your email address.                 │
│                                                                   │
│  [Download Receipt] [View Booking Details]                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛒 FLOATING CART BEHAVIOR

### Cart States

#### MINIMIZED (Default)
```
┌─────────────────┐
│  🛒 Cart (3)    │
│  RM 1,700       │
└─────────────────┘
```

#### EXPANDED (On Click)
```
┌──────────────────────────────────────┐
│ YOUR CART                      [×]   │
├──────────────────────────────────────┤
│                                      │
│ Extended Flight Time (+30 Mins)      │
│ RM 900.00                      [🗑]  │
│                                      │
│ Luxury Car Transfer                  │
│ RM 450.00                      [🗑]  │
│                                      │
│ Sky Moments Video                    │
│ RM 350.00                      [🗑]  │
│                                      │
├──────────────────────────────────────┤
│ Subtotal:           RM 1,700.00      │
│ Tax (0%):           RM 0.00          │
│ ─────────────────────────────────    │
│ TOTAL:              RM 1,700.00      │
├──────────────────────────────────────┤
│                                      │
│ [Continue Shopping] [Checkout →]    │
└──────────────────────────────────────┘
```

### Cart Animation Triggers

1. **Item Added**: 
   - Cart badge bounces
   - Shows "+RM 900" floating animation
   - Auto-expands for 2 seconds

2. **Item Removed**:
   - Slide out animation
   - Recalculates total with animation

3. **Cart Clicked**:
   - Slides up from bottom
   - Overlay darkens background

4. **Suggestion Accepted**:
   - Item flies into cart icon
   - Badge increments with animation

---

## 💡 SUGGESTION ENGINE RULES

### Trigger Matrix

| Condition | Suggestion | Display Timing |
|-----------|-----------|----------------|
| Extended Flight Time selected | Sky Moments Video | After Step 1 |
| Additional Passenger selected | Highlight Reel Video | After Step 1 |
| Cart > RM 1,000 | Premium packages | After Step 3 |
| No video package selected | Any video package | After Step 3 |
| Multiple celebration items | Full Combo Package | Real-time popup |
| Cart empty at Step 3 | Popular packages | Before Step 4 |

### Suggestion Display Format

```
┌─────────────────────────────────────┐
│ 💡 Perfect Addition!           [×]  │
├─────────────────────────────────────┤
│                                     │
│ [Image of suggested item]           │
│                                     │
│ Sky Moments Video                   │
│ Capture your extended flight with   │
│ a 2-minute cinematic video!         │
│                                     │
│ Original Price: RM 350              │
│ Special Offer: RM 315 (10% OFF)     │
│                                     │
│ [Add to Cart] [No Thanks]           │
│                                     │
│ ⏱ Offer expires in: 00:05          │
└─────────────────────────────────────┘
```

---

## 🔧 ADMIN PANEL STRUCTURE

```
ADMIN DASHBOARD
├── 📊 Dashboard
│   ├── Today's Revenue
│   ├── Pending Bookings
│   ├── Popular Packages
│   └── Recent Transactions
│
├── 📦 Package Management
│   ├── View All Packages
│   ├── Add New Package
│   ├── Edit Package
│   ├── Categories
│   └── Package Orders (Drag & Drop)
│
├── 🛒 Bookings
│   ├── All Bookings
│   ├── Pending Payments
│   ├── Confirmed
│   ├── Completed
│   └── Cancelled
│
├── 💳 Payments
│   ├── Transactions
│   ├── CHIP Configuration
│   ├── Payment Methods
│   └── Refunds
│
├── 💡 Suggestions
│   ├── Suggestion Rules
│   ├── Create New Rule
│   ├── Analytics
│   └── A/B Testing
│
├── 👥 Customers
│   ├── Customer List
│   ├── Booking History
│   └── Communication
│
├── ⚙️ Settings
│   ├── General Settings
│   ├── Payment Gateway
│   ├── Email Templates
│   ├── SMS Settings
│   └── Tax & Fees
│
└── 📈 Reports
    ├── Sales Report
    ├── Package Performance
    ├── Customer Analytics
    └── Payment Reports
```

---

## 📋 PACKAGE MANAGEMENT INTERFACE

```
ADD/EDIT PACKAGE
┌──────────────────────────────────────────────────┐
│                                                  │
│ Category: [Flight Upgrades ▼]                   │
│                                                  │
│ Package Name: [_____________________________]   │
│                                                  │
│ Description:                                     │
│ [_________________________________________]     │
│ [_________________________________________]     │
│                                                  │
│ Price: RM [________]                            │
│                                                  │
│ Upload Image: [Choose File] [Preview]           │
│                                                  │
│ ☑ Active                                        │
│ ☐ Featured                                      │
│ ☐ Limited Time Offer                            │
│                                                  │
│ Max Quantity: [___] (0 = unlimited)             │
│                                                  │
│ Sort Order: [___]                               │
│                                                  │
│ [Save Package] [Cancel]                         │
└──────────────────────────────────────────────────┘
```

---

## 🎯 SUGGESTION RULE BUILDER

```
CREATE SUGGESTION RULE
┌──────────────────────────────────────────────────┐
│                                                  │
│ Rule Name: [Extended Flight Video Upsell]       │
│                                                  │
│ Trigger Condition:                               │
│ [When] [Extended Flight Time] [is selected] ✓   │
│                                                  │
│ Suggest Package: [Sky Moments Video ▼]          │
│                                                  │
│ Display Message:                                 │
│ [Capture your extended flight experience!]      │
│                                                  │
│ Timing:                                          │
│ ○ After current step                            │
│ ● Before next step                              │
│ ○ On cart review                                │
│                                                  │
│ Discount:                                        │
│ ☑ Apply discount  [10]% OFF                     │
│                                                  │
│ Priority: [Medium ▼]                            │
│                                                  │
│ ☑ Active                                        │
│                                                  │
│ [Save Rule] [Test Rule] [Cancel]                │
└──────────────────────────────────────────────────┘
```

---

## 🔐 CHIP PAYMENT CONFIGURATION

```
PAYMENT GATEWAY SETTINGS
┌──────────────────────────────────────────────────┐
│                                                  │
│ Gateway: CHIP Payment Gateway                    │
│                                                  │
│ Mode: ● Test Mode  ○ Live Mode                  │
│                                                  │
│ Brand ID: [_____________________________]       │
│                                                  │
│ API Key: [●●●●●●●●●●●●●●●●●●●●] [Show]         │
│                                                  │
│ Secret Key: [●●●●●●●●●●●●●●●●●] [Show]          │
│                                                  │
│ Webhook URL:                                     │
│ [https://yoursite.com/webhook/chip]             │
│                                                  │
│ Success URL:                                     │
│ [/booking/success]                              │
│                                                  │
│ Cancel URL:                                      │
│ [/booking/cancelled]                            │
│                                                  │
│ Currency: [MYR ▼]                               │
│                                                  │
│ ☑ Enable payment gateway                        │
│ ☑ Send receipt email                            │
│                                                  │
│ [Test Connection] [Save Settings]               │
└──────────────────────────────────────────────────┘
```

---

## 📱 RESPONSIVE BEHAVIOR

### Mobile Cart (Bottom Sheet)
```
┌─────────────────────────┐
│      [Swipe Up]         │
│  ==================     │
│                         │
│  🛒 Your Cart (3)       │
│  RM 1,700.00           │
│                         │
│  [View Cart]            │
└─────────────────────────┘
```

### Tablet View
- Side panel cart
- Grid layout for packages (2 columns)

### Desktop View
- Sticky header cart
- Grid layout for packages (3-4 columns)
- Fixed sidebar for filters

---

End of Flow Documentation
