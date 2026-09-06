import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BrandLoader } from "@/components/page/PageChrome";
import { MobileScrollToTop } from "@/components/ui/MobileScrollToTop";
import { useShareTracking } from "@/hooks/useShareTracking";
import { useCart } from "@/context/CartContext";
import { SHARE_REF_PARAM, resolveShareLink, trackShareEvent } from "@/lib/agentTracking";

// Same lazy shape the home and packages pages use, so the wizard is only
// pulled in when an agent page actually needs it.
const BookingWizard = lazy(() =>
  import("@/components/BookingWizard").then(m => ({ default: m.BookingWizard }))
);

// Only a page carrying a live price-slash campaign ever renders this, and
// the panel itself returns null when there is none - so the canvas games
// stay out of the bundle for every ordinary page.
const SlashGamePanel = lazy(() =>
  import("@/components/slash/SlashGamePanel").then(m => ({ default: m.SlashGamePanel }))
);

/**
 * Who is presenting this template: supplied by the share link the visitor
 * arrived through, falling back to the page's own stored values.
 */
interface Presenter {
  agent_name: string | null;
  coupon_code: string | null;
  whatsapp_number: string | null;
  whatsapp_message: string | null;
}

interface LandingPage {
  id: string;
  slug: string;
  title: string;
  agent_name: string | null;
  html_content: string;
  meta_description: string | null;
  package_id: string | null;
  category_id: string | null;
  coupon_id: string | null;
  show_wizard: boolean;
  show_header: boolean;
  show_footer: boolean;
  whatsapp_number: string | null;
  whatsapp_message: string | null;
}

/**
 * /p/:slug — a page an agent wrote in the admin HTML editor.
 *
 * The agent's own markup sits on top; underneath it the visitor gets the exact
 * same package carousel and booking wizard as the main site, so the flow ends
 * at the same payment step. Any coupon attached to the page is put on the URL
 * before the wizard mounts, which is where BookingWizard reads it from.
 */
export default function AgentLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<LandingPage | null>(null);
  const [presenter, setPresenter] = useState<Presenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [urlReady, setUrlReady] = useState(false);

  // Starts once the page id is known, so the view/scroll rows are attributed
  // to this landing page as well as to the share link the visitor came from.
  useShareTracking(page?.id ?? null);

  // The cart is read through a ref so this can inspect it without the
  // prune below re-running every time the cart changes - which would fight
  // the visitor as they add things.
  const { items: cartItems, removeItem } = useCart();
  const cartRef = useRef(cartItems);
  cartRef.current = cartItems;
  const prunedFor = useRef<string | null>(null);

  /**
   * A landing page sells one category, so the cart has to arrive empty of
   * everything else.
   *
   * Without this, a package left over from another page stays in the cart
   * as the booking's one permitted sort_order 0 item, and
   * FlightPackagesSection greys out every package on THIS page - the
   * visitor lands on a page they cannot buy anything from, with no
   * explanation. Only foreign items go: anything already added from this
   * page's own category is the visitor's work and is left alone.
   */
  useEffect(() => {
    if (!page?.category_id) return;              // "All packages" pages sell everything
    if (prunedFor.current === page.id) return;   // once per page, not once per render
    prunedFor.current = page.id;

    for (const item of cartRef.current) {
      if (item.category_id && item.category_id !== page.category_id) {
        removeItem(item.id, item.sort_order);
      }
    }
  }, [page?.id, page?.category_id, removeItem]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!slug || !supabase) { setNotFound(true); setLoading(false); return; }
      setLoading(true);

      try {
        // ?preview=1 drops the published filter so staff can proof a draft.
        // This is safe without an extra check: RLS only lets a signed-in staff
        // account read unpublished rows, so a visitor still gets nothing.
        const isPreview = new URLSearchParams(window.location.search).get('preview') === '1';

        let query = supabase
          .from('agent_landing_pages')
          .select('id, slug, title, agent_name, html_content, meta_description, package_id, category_id, coupon_id, show_wizard, show_header, show_footer, whatsapp_number, whatsapp_message')
          .ilike('slug', slug);

        if (!isPreview) query = query.eq('is_published', true);

        const { data, error } = await query.maybeSingle();

        if (cancelled) return;

        if (error || !data) { setNotFound(true); setLoading(false); return; }

        const url0 = new URL(window.location.href);

        const p = data as LandingPage;
        setPage(p);

        // Record which page this is, so anything reading the share context
        // — the package prices especially — can find the campaign attached
        // to it. Counts no extra click: with no ?ref= this only stores the id.
        await resolveShareLink(p.id);
        if (cancelled) return;

        // The page is only a template. Who is selling it - the agent's name,
        // their coupon and their WhatsApp number - travels on the share link
        // the visitor arrived through, so the same design can be handed to
        // several agents. A page opened directly, with no ?ref=, falls back to
        // whatever identity is still stored on the page itself.
        let who: Presenter = {
          agent_name: p.agent_name,
          coupon_code: null,
          whatsapp_number: p.whatsapp_number,
          whatsapp_message: p.whatsapp_message,
        };

        const refToken = url0.searchParams.get(SHARE_REF_PARAM);
        if (refToken) {
          const { data: rows } = await supabase.rpc('resolve_share_link', { p_token: refToken });
          const link = Array.isArray(rows) ? rows[0] : rows;
          if (link) {
            who = {
              agent_name: link.agent_name ?? who.agent_name,
              coupon_code: link.coupon_code ?? null,
              whatsapp_number: link.whatsapp_number ?? who.whatsapp_number,
              whatsapp_message: link.whatsapp_message ?? who.whatsapp_message,
            };
          }
        }

        if (cancelled) return;
        setPresenter(who);

        // Put the page's package and the presenter's coupon on the URL before
        // the wizard mounts — that is the contract BookingWizard and
        // FlightPackagesSection already use for shared links.
        const url = url0;
        let changed = false;

        if (p.package_id) {
          // A featured package narrows the wizard to that package's category.
          if (url.searchParams.get('sharePackageId') !== p.package_id) {
            url.searchParams.set('sharePackageId', p.package_id);
            changed = true;
          }
        } else if (url.searchParams.get('sharePackageId')) {
          // "All packages" is authoritative: strip any sharePackageId carried
          // over from an older link or a previous visit, otherwise the wizard
          // stays stuck on one category and never shows the full lineup.
          url.searchParams.delete('sharePackageId');
          changed = true;
        }

        if (who.coupon_code && url.searchParams.get('coupon') !== who.coupon_code) {
          url.searchParams.set('coupon', who.coupon_code);
          changed = true;
        }

        if (cancelled) return;
        if (changed) window.history.replaceState({}, '', url.toString());

        document.title = p.title;
        if (p.meta_description) {
          let meta = document.querySelector('meta[name="description"]');
          if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('name', 'description');
            document.head.appendChild(meta);
          }
          meta.setAttribute('content', p.meta_description);
        }

        setUrlReady(true);
        setLoading(false);
      } catch (e) {
        console.error('[AgentLanding] failed to load', e);
        if (!cancelled) { setNotFound(true); setLoading(false); }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [slug]);

  // wa.me wants digits only - strip spaces, dashes and a leading +.
  const waNumber = (presenter?.whatsapp_number || '').replace(/\D/g, '');
  const waHref = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(
        presenter?.whatsapp_message
          || `Hi ${presenter?.agent_name || 'there'}, I am interested in ${page?.title || 'your flight packages'}.`,
      )}`
    : '';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <BrandLoader label="Loading" />
      </div>
    );
  }

  if (notFound || !page) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Page not found</h1>
        <p className="text-sm text-slate-500 max-w-sm">
          This page is not published, or the address is wrong.
        </p>
        <a
          href="/"
          className="mt-2 inline-flex h-11 items-center rounded-xl bg-[#CD5C5C] px-8 text-[11px] font-black uppercase tracking-[0.2em] text-white"
        >
          Go to the homepage
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {page.show_header && <Header />}

      <main className={page.show_header ? "pt-16" : ""}>
        {/* The agent's own markup, exactly as written in the admin editor. */}
        <section
          className="agent-landing-content"
          dangerouslySetInnerHTML={{ __html: page.html_content || '' }}
        />

        {/* Sits above the booking steps: the visitor plays for a discount
            first, then books with it already applied. */}
        {urlReady && (
          <Suspense fallback={null}>
            <SlashGamePanel landingPageId={page.id} />
          </Suspense>
        )}

        {/* The wizard opens on its own package carousel, so it is the single
            place packages are shown on an agent page. */}
        {page.show_wizard && urlReady && (
          <section id="book-now" className="scroll-mt-20">
            <Suspense
              fallback={
                <div className="flex min-h-[420px] items-center justify-center">
                  <BrandLoader label="Preparing your booking" />
                </div>
              }
            >
              <BookingWizard />
            </Suspense>
          </section>
        )}

        {presenter?.agent_name && (
          <p className="py-8 text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            Presented by {presenter.agent_name}
          </p>
        )}
      </main>

      {page.show_footer && <Footer />}

      {/* The agent's own WhatsApp, not the company line - a lead from this page
          should reach the person who shared it. Sits below the cart button,
          which is fixed at bottom-24. */}
      {waNumber && (
        <a
          href={waHref}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackShareEvent({
            event_type: 'click',
            landingPageId: page.id,
            metadata: { target: 'whatsapp', agent: presenter?.agent_name },
          })}
          aria-label={`Chat with ${presenter?.agent_name || 'us'} on WhatsApp`}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] shadow-[0_8px_24px_rgba(37,211,102,0.45)] transition-transform hover:scale-110 active:scale-95 md:h-14 md:w-14"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-white md:h-7 md:w-7" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.9 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.4" />
          </svg>
        </a>
      )}

      <MobileScrollToTop />
    </div>
  );
}
