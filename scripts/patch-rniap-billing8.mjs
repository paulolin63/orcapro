/**
 * Adapta react-native-iap@12.16.x ao Play Billing Library 8.x
 * (enablePendingPurchases params, QueryProductDetailsResult, sem purchase history).
 * Roda no postinstall.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(
  root,
  'node_modules/react-native-iap/android/src/play/java/com/dooboolab/rniap/RNIapModule.kt'
);

if (!fs.existsSync(target)) {
  console.warn('[patch-rniap-billing8] RNIapModule.kt nao encontrado — skip');
  process.exit(0);
}

let src = fs.readFileSync(target, 'utf8');
if (src.includes('ORCAPRO_BILLING8_PATCH')) {
  console.log('[patch-rniap-billing8] ja aplicado');
  process.exit(0);
}

const marker = '// ORCAPRO_BILLING8_PATCH\n';

// 1) Imports
if (!src.includes('PendingPurchasesParams')) {
  src = src.replace(
    'import com.android.billingclient.api.AcknowledgePurchaseParams\n',
    'import com.android.billingclient.api.AcknowledgePurchaseParams\nimport com.android.billingclient.api.PendingPurchasesParams\n'
  );
}

// 2) enablePendingPurchases() -> PendingPurchasesParams
src = src.replace(
  /BillingClient\.newBuilder\(reactContext\)\.enablePendingPurchases\(\)/,
  `BillingClient.newBuilder(reactContext).enablePendingPurchases(
        PendingPurchasesParams.newBuilder().enableOneTimeProducts().build(),
    )`
);

// 3) queryProductDetailsAsync callback: 2nd arg is QueryProductDetailsResult
src = src.replace(
  /billingClient\.queryProductDetailsAsync\(params\) \{ billingResult, skuDetailsList ->\n(\s*)if \(!isValidResult\(billingResult, promise\)\) return@queryProductDetailsAsync\n\n(\s*)val items = Arguments\.createArray\(\)\n(\s*)for \(skuDetails in skuDetailsList\) \{/,
  `billingClient.queryProductDetailsAsync(params) { billingResult, productDetailsResult ->\n$1if (!isValidResult(billingResult, promise)) return@queryProductDetailsAsync\n\n$2val skuDetailsList = productDetailsResult.productDetailsList\n$2val items = Arguments.createArray()\n$3for (skuDetails in skuDetailsList) {`
);

// 4) getPurchaseHistoryByType: Billing 8 removeu queryPurchaseHistoryAsync → usa queryPurchasesAsync
const historyOld = `    @ReactMethod
    fun getPurchaseHistoryByType(
        type: String,
        promise: Promise,
    ) {
        ensureConnection(
            promise,
        ) { billingClient ->
            billingClient.queryPurchaseHistoryAsync(
                QueryPurchaseHistoryParams
                    .newBuilder()
                    .setProductType(
                        if (type == "subs") BillingClient.ProductType.SUBS else BillingClient.ProductType.INAPP,
                    ).build(),
            ) { billingResult: BillingResult, purchaseHistoryRecordList: MutableList<PurchaseHistoryRecord>? ->

                if (!isValidResult(billingResult, promise)) return@queryPurchaseHistoryAsync

                Log.d(TAG, purchaseHistoryRecordList.toString())
                val items = Arguments.createArray()
                purchaseHistoryRecordList?.forEach { purchase ->
                    val item = Arguments.createMap()
                    item.putString("productId", purchase.products[0])
                    val products = Arguments.createArray()
                    purchase.products.forEach { products.pushString(it) }
                    item.putArray("productIds", products)
                    item.putDouble("transactionDate", purchase.purchaseTime.toDouble())
                    item.putString("transactionReceipt", purchase.originalJson)
                    item.putString("purchaseToken", purchase.purchaseToken)
                    item.putString("dataAndroid", purchase.originalJson)
                    item.putString("signatureAndroid", purchase.signature)
                    item.putString("developerPayload", purchase.developerPayload.orEmpty())
                    items.pushMap(item)
                }
                promise.safeResolve(items)
            }
        }
    }`;

const historyNew = `    // ORCAPRO_BILLING8_PATCH — purchase history API removida no Billing 8
    @ReactMethod
    fun getPurchaseHistoryByType(
        type: String,
        promise: Promise,
    ) {
        ensureConnection(
            promise,
        ) { billingClient ->
            billingClient.queryPurchasesAsync(
                QueryPurchasesParams
                    .newBuilder()
                    .setProductType(
                        if (type == "subs") BillingClient.ProductType.SUBS else BillingClient.ProductType.INAPP,
                    ).build(),
            ) { billingResult: BillingResult, purchases: MutableList<Purchase>? ->
                if (!isValidResult(billingResult, promise)) return@queryPurchasesAsync

                Log.d(TAG, purchases.toString())
                val items = Arguments.createArray()
                purchases?.forEach { purchase ->
                    val item = Arguments.createMap()
                    item.putString("productId", purchase.products[0])
                    val products = Arguments.createArray()
                    purchase.products.forEach { products.pushString(it) }
                    item.putArray("productIds", products)
                    item.putDouble("transactionDate", purchase.purchaseTime.toDouble())
                    item.putString("transactionReceipt", purchase.originalJson)
                    item.putString("purchaseToken", purchase.purchaseToken)
                    item.putString("dataAndroid", purchase.originalJson)
                    item.putString("signatureAndroid", purchase.signature)
                    item.putString("developerPayload", purchase.developerPayload.orEmpty())
                    items.pushMap(item)
                }
                promise.safeResolve(items)
            }
        }
    }`;

if (!src.includes(historyOld)) {
  console.error('[patch-rniap-billing8] bloco getPurchaseHistoryByType nao bateu — ajuste manual');
  process.exit(1);
}
src = src.replace(historyOld, historyNew);

// Clean unused imports if present (optional)
src = src.replace(/import com\.android\.billingclient\.api\.PurchaseHistoryRecord\n/, '');
src = src.replace(/import com\.android\.billingclient\.api\.QueryPurchaseHistoryParams\n/, '');

if (!src.includes('ORCAPRO_BILLING8_PATCH')) {
  src = marker + src;
}

fs.writeFileSync(target, src);
console.log('[patch-rniap-billing8] RNIapModule.kt adaptado para Billing 8');
