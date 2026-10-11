import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';

const svg = (label, fill) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="' + fill + '"/><text x="300" y="300" text-anchor="middle" font-size="35" fill="#fff">' + label + '</text></svg>'
);
const ordinaryImage = svg('ORDINARY PRODUCT', '#445566');
const selectedTemplate = svg('ADMIN PRINT TEMPLATE', '#2a3235');
const fixture = {
  id:'fixture-hoodie', printifyId:'fixture-hoodie', title:'Fixture Hoodie',
  description:'Fixture for testing personalisation', category:'Hoodies', rangeId:null,
  audience:'Unisex', productType:'Hoodie', garment:'Hoodie', pricingMatrix:null,
  images:[
    {src:ordinaryImage,isDefault:true,variantIds:[10],color:'Black'},
    {src:selectedTemplate,isDefault:false,variantIds:[10],color:'Black'}
  ],
  variants:[{id:10,color:'Black',size:'M',price:2999,available:true}],
  colors:[{name:'Black',hex:'#000000'}],hiddenColors:[],sizes:['M'],
  minPrice:2999,maxPrice:2999,isEnabled:true,personalizationEnabled:true,
  personalizationType:'initials',
  initialsPlacements:{Black:{imageSrc:selectedTemplate,x:18,y:25,width:18,height:9,fontSize:38,color:'#ffffff'}},
  checkSizing:false,sizeGuideImage:null,
  syncedAt:'2026-10-11',createdAt:'2026-10-11',updatedAt:'2026-10-11'
};

for (const engine of [chromium, webkit]) {
const browser = await engine.launch({headless:true});
try {
  for (const viewport of [{width:390,height:844},{width:1365,height:900}]) {
    const page = await browser.newPage({viewport});
    await page.route('**/api/products/fixture-hoodie*', async route => route.fulfill({
      status:200, contentType:'application/json', body:JSON.stringify({product:fixture})
    }));
    await page.goto('http://127.0.0.1:5173/product/fixture-hoodie');
    await page.getByText('Fixture Hoodie').first().waitFor();
    const templateThumb = page.getByRole('button',{name:'View initials preview'});
    await templateThumb.waitFor();
    await templateThumb.click();
    const canvasImage = page.getByAltText('Fixture Hoodie personalised preview');
    await canvasImage.waitFor();
    assert.equal(await canvasImage.getAttribute('src'),selectedTemplate,'Gallery did not render the saved admin image');
    const previewArea = page.locator('div[style*="left: 18%"][style*="top: 25%"]').first();
    await previewArea.waitFor();
    assert.match((await previewArea.innerText()),/ABC/);

    await page.getByRole('button',{name:/Personalise This.*£5/i}).click();
    await page.getByPlaceholder('ABC').fill('SW');
    await page.getByRole('button',{name:'Preview on product'}).click();
    await page.getByRole('button',{name:'Confirm this personalisation'}).waitFor();
    assert.match(await previewArea.innerText(),/SW/);
    await page.getByRole('button',{name:'Confirm this personalisation'}).click();
    await page.getByText('Choose size and quantity').waitFor();
    await page.close();
    console.log('PASS '+engine.name()+' personalisation at '+viewport.width+'x'+viewport.height);
  }
} finally {
  await browser.close();
}
}
