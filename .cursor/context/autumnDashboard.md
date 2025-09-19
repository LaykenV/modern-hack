### Autumn Dashboard Configuration

- **Credit system (`atlas_credits`)**
  - **Free (default)**: 15 credits, one-time grant (no monthly refill)
  - **Pro**: 100 credits per month
  - **Business**: 500 credits per month

- **Boolean features**
  - **priority_support**: enabled on Business tier

- **Credit products and costs (charged in `atlas_credits`)**
  - **lead_discovery**: 1.0 per unit
  - **dossier_research**: 2.0 per unit
  - **ai_call_minutes**: 1.0 per minute
  - **dossier_qa**: 0.2 per unit

### Plans

| Plan | Product ID | Price | Included `atlas_credits` | Reset | Priority Support |
| --- | --- | --- | --- | --- | --- |
| Free (default) | N/A | $0 | 15 one-time | N/A | No |
| Pro | `pro` | $49/mo | 100 / month | Monthly | No |
| Business | `business` | $199/mo | 500 / month | Monthly | Yes |

### Integration notes

- Use `openBillingPortal({ returnUrl })` for billing management UI.
- Checkout examples use `productId: "pro"` and `productId: "business"`. Update if your actual product IDs differ.
- Server-side metering examples (values represent `atlas_credits` consumed):
  - `featureId: "lead_discovery"`, value: `1`
  - `featureId: "dossier_research"`, value: `2`
  - `featureId: "ai_call_minutes"`, value: `1 per minute`
  - `featureId: "dossier_qa"`, value: `0.2`


