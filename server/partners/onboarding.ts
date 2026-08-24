import type { Env } from '../../types/env.js';
import type { PartnerAdmin, PartnerOnboardingAsset } from '../../types/index.js';
import { deleteAsset, storeAssetData } from '../assets/storage.js';
import { replacePartnerOnboardingAssets } from './repository.js';

function resolveClubCode(partner: Pick<PartnerAdmin, 'slug' | 'discountCode'>): string {
  return (partner.discountCode?.trim() || partner.slug.trim()).toUpperCase();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildLiteratureHtml(partnerName: string, clubCode: string): string {
  const safePartnerName = escapeHtml(partnerName);
  const safeClubCode = escapeHtml(clubCode);
  const template = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Up The Creek Onboarding Literature - YOURCLUB</title>
  <style>
    :root {
      --bg: #07101f;
      --panel: #0d1729;
      --text: #f5efe4;
      --muted: #c6b79c;
      --accent: #c9924f;
      --line: rgba(201, 146, 79, 0.35);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      background: linear-gradient(180deg, #081021 0%, #050b16 100%);
      color: var(--text);
    }
    .page {
      min-height: 100vh;
      padding: 48px;
      background:
        radial-gradient(circle at top, rgba(201,146,79,0.12), transparent 35%),
        radial-gradient(circle at bottom right, rgba(255,255,255,0.05), transparent 24%);
    }
    .card {
      max-width: 980px;
      margin: 0 auto;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 28px;
      background: rgba(13, 23, 41, 0.9);
      padding: 40px;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
    }
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.24em;
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      margin: 0 0 14px;
    }
    h1 {
      margin: 0;
      font-size: 44px;
      line-height: 1;
      letter-spacing: -0.04em;
    }
    .club {
      margin-top: 10px;
      color: var(--accent);
      font-size: 20px;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      font-weight: 700;
    }
    .code {
      margin-top: 12px;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      border-radius: 999px;
      background: rgba(201,146,79,0.12);
      border: 1px solid var(--line);
      color: var(--accent);
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.18em;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
      margin-top: 28px;
    }
    .panel {
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 22px;
      background: rgba(7, 16, 31, 0.55);
      padding: 22px;
    }
    .panel h2 {
      margin: 0 0 10px;
      font-size: 18px;
      color: white;
    }
    .panel p, .panel li {
      margin: 0;
      color: rgba(245,239,228,0.78);
      line-height: 1.7;
      font-size: 14px;
    }
    .panel ul {
      margin: 0;
      padding-left: 18px;
    }
    .note {
      margin-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.08);
      padding-top: 18px;
      color: rgba(198,183,156,0.9);
      font-size: 13px;
      line-height: 1.6;
    }
    .placeholder {
      margin-top: 18px;
      padding: 16px;
      border-radius: 18px;
      border: 1px dashed rgba(201,146,79,0.5);
      color: rgba(201,146,79,0.92);
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 12px;
      text-align: center;
    }
    @media (max-width: 800px) {
      .page { padding: 18px; }
      .card { padding: 22px; }
      h1 { font-size: 32px; }
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="card">
      <p class="eyebrow">Onboarding literature placeholder</p>
      <h1>${safePartnerName}</h1>
      <div class="club">Partner pack for YOURCLUB</div>
      <div class="code">USE CODE YOURCLUB</div>

      <div class="grid">
        <article class="panel">
          <h2>What this will become</h2>
          <p>This placeholder stands in for the final onboarding literature template.</p>
          <p style="margin-top:12px;">Replace this file with the approved club literature when supplied.</p>
        </article>
        <article class="panel">
          <h2>Suggested copy blocks</h2>
          <ul>
            <li>Welcome to the club partner pack.</li>
            <li>Tell members to use code YOURCLUB online.</li>
            <li>Display signage in the clubhouse and retail area.</li>
            <li>Keep the discount code visible on printed material.</li>
          </ul>
        </article>
      </div>

      <div class="placeholder">PLACEHOLDER TEMPLATE - LITERATURE FOR YOURCLUB</div>
      <div class="note">
        Stored in R2 for recall. When final literature templates are supplied, this artefact can be replaced without changing the partner record.
      </div>
    </section>
  </main>
</body>
</html>`;

  return template.replaceAll('YOURCLUB', safeClubCode);
}

function buildSignageHtml(partnerName: string, clubCode: string): string {
  const safePartnerName = escapeHtml(partnerName);
  const safeClubCode = escapeHtml(clubCode);
  const codeLength = Math.max(safeClubCode.length, 1);
  const fontSize = codeLength > 14 ? 24 : codeLength > 10 ? 27 : 30;
  const letterSpacing = codeLength > 14 ? 4 : codeLength > 10 ? 6 : 9;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1004" height="591" viewBox="0 0 1004 591" role="img" aria-labelledby="title desc">
  <title id="title">Up The Creek partner signage - ${safeClubCode}</title>
  <desc id="desc">Printable partner signage for ${safePartnerName}, using discount code ${safeClubCode}.</desc>
  <image href="/onboarding/UTC_Club_sign.png" x="0" y="0" width="1004" height="591" preserveAspectRatio="none" />
  <rect x="381" y="499" width="252" height="38" fill="#080d15" />
  <text
    x="507"
    y="530"
    text-anchor="middle"
    fill="#b98a50"
    font-family="Montserrat, Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="900"
    letter-spacing="${letterSpacing}"
  >${safeClubCode}</text>
</svg>`;
}

export async function generatePartnerOnboardingAssets(
  env: Env,
  partner: Pick<PartnerAdmin, 'id' | 'slug' | 'name' | 'discountCode'>,
): Promise<PartnerOnboardingAsset[]> {
  const clubCode = resolveClubCode(partner);
  const literature = buildLiteratureHtml(partner.name, clubCode);
  const signage = buildSignageHtml(partner.name, clubCode);

  const literatureAsset = await storeAssetData(
    env.IMAGES,
    new TextEncoder().encode(literature),
    'text/html; charset=utf-8',
    {
      kind: 'partner-onboarding-literature',
      keyPrefix: `partner-onboarding/${partner.id}`,
      keySeed: `${partner.id}:partner-onboarding-literature`,
      sourceHint: 'onboarding-literature.html',
      metadata: {
        partnerId: partner.id,
      },
    },
  );

  const signageAsset = await storeAssetData(
    env.IMAGES,
    new TextEncoder().encode(signage),
    'image/svg+xml; charset=utf-8',
    {
      kind: 'partner-onboarding-signage',
      keyPrefix: `partner-onboarding/${partner.id}`,
      keySeed: `${partner.id}:partner-onboarding-signage`,
      sourceHint: 'onboarding-signage.svg',
      metadata: {
        partnerId: partner.id,
      },
    },
  );

  const assets: PartnerOnboardingAsset[] = [
    {
      id: `${partner.id}:literature`,
      partnerId: partner.id,
      assetType: 'literature',
      title: `${partner.name} onboarding literature`,
      url: literatureAsset.url,
      r2Key: literatureAsset.key,
      contentType: 'image/svg+xml; charset=utf-8',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `${partner.id}:signage`,
      partnerId: partner.id,
      assetType: 'signage',
      title: `${partner.name} signage`,
      url: signageAsset.url,
      r2Key: signageAsset.key,
      contentType: 'text/html; charset=utf-8',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  try {
    await replacePartnerOnboardingAssets(env.DB, partner.id, assets);
    return assets;
  } catch (err) {
    await Promise.all([
      deleteAsset(env.IMAGES, literatureAsset.key),
      deleteAsset(env.IMAGES, signageAsset.key),
    ]);
    throw err;
  }
}
