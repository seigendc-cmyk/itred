/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  Edit3,
  Image as ImageIcon,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  Package,
  PackageSearch,
  Plus,
  Square,
  Save,
  Search,
  Tag,
  Trash2,
  Upload,
  X
} from 'lucide-react'
import {
  BrandedAlertModal,
  ConfirmDialog,
  DataPanel,
  EmptyState,
  PrimaryButton,
  SearchInput,
  SearchableComboBox,
  SecondaryButton,
  StatCard,
  StatusBadge,
  TablePanel
} from '../components/CommonUI.tsx'
import { MasterProduct, ProductStatus } from '../types.ts'
import { productService } from '../services/productService.ts'
import { taxonomyService } from '../services/taxonomyService.ts'
import { permissionService } from '../services/permissionService.ts'
import { staffAuditService } from '../services/staffAuditService.ts'
import { compressImage, formatSize } from '../lib/imageUtils.ts'
import { useFormDraft } from '../hooks/useFormDraft.ts'
import { offlineSyncService } from '../services/offlineSyncService.ts'
import { getDraft } from '../utils/localDraftStorage.ts'
import {
  getMaxImagesForListing,
  normalizeListingImages
} from '../utils/listingImageEntitlements.ts'

const ENABLE_PRODUCT_DRAFT_RECOVERY = false

const PRODUCT_STATUSES: ProductStatus[] = [
  'active',
  'hidden',
  'discontinued',
  'pending_review'
]

const inputClass =
  'w-full border-2 border-stone-200 bg-white p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange'

const buildSearchableText = (product: Partial<MasterProduct>) =>
  [
    product.productName,
    product.brand,
    product.category,
    product.sector,
    product.description,
    product.barcode,
    product.standardSku,
    ...(product.tags || []),
    ...(product.keywords || [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

const PRODUCT_DRAFT_KEY_PREFIX = 'itred_master_product_draft'

const getProductDraftKey = (productId?: string) =>
  `${PRODUCT_DRAFT_KEY_PREFIX}_${productId || 'new'}`

const getProductDraftStorageKey = (productId?: string) =>
  `itred_form_draft:${getProductDraftKey(productId)}`

const PRODUCT_LIST_CACHE_KEY = 'itred_cache_products'

const stripLargeProductImagesForCache = (
  product: MasterProduct
): MasterProduct => ({
  ...product,
  imageUrl: product.imageUrl?.startsWith('data:image/') ? '' : product.imageUrl,
  additionalImages: []
})

const readCachedProducts = (): MasterProduct[] => {
  try {
    const raw = localStorage.getItem(PRODUCT_LIST_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.products) ? parsed.products : []
  } catch {
    return []
  }
}

const writeCachedProducts = (products: MasterProduct[]) => {
  try {
    localStorage.setItem(
      PRODUCT_LIST_CACHE_KEY,
      JSON.stringify({
        products: products.map(stripLargeProductImagesForCache),
        updatedAt: new Date().toISOString()
      })
    )
  } catch {
    // Product cache is a best-effort UI accelerator.
  }
}

const hasMeaningfulProductDraft = (draft: Partial<MasterProduct> | null) =>
  !!(
    draft?.productName ||
    draft?.sector ||
    draft?.category ||
    draft?.brand ||
    draft?.standardSku
  )

const loadProductDraftFromLocalStorage = (
  productId?: string
): Partial<MasterProduct> | null => {
  try {
    const storageKey = getProductDraftStorageKey(productId)
    const draft = getDraft<Partial<MasterProduct>>(storageKey)
    if (!hasMeaningfulProductDraft(draft)) {
      localStorage.removeItem(storageKey)
      return null
    }

    return draft
  } catch (error) {
    localStorage.removeItem(getProductDraftStorageKey(productId))
    return null
  }
}

const newMasterProduct = (): MasterProduct => {
  const now = new Date().toISOString()
  return {
    id: `MP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    productName: '',
    brand: '',
    category: '',
    sector: '',
    description: '',
    barcode: '',
    standardSku: '',
    tags: [],
    keywords: [],
    imageUrl: '',
    images: [],
    additionalImages: [],
    unit: 'Each',
    searchableText: '',
    status: 'active',
    createdAt: now,
    updatedAt: now
  }
}

export const ProductManagement: React.FC = () => {
  const [products, setProducts] = useState<MasterProduct[]>([])
  const [sectors, setSectors] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [newSector, setNewSector] = useState('')
  const [modalState, setModalState] = useState<
    'normal' | 'maximized' | 'minimized'
  >('normal')
  const [editorBaseline, setEditorBaseline] = useState('')
  const [editingProduct, setEditingProduct] = useState<MasterProduct | null>(
    null
  )
  const [isSavingProduct, setIsSavingProduct] = useState(false)
  const [hasAttemptedProductSave, setHasAttemptedProductSave] = useState(false)
  const [search, setSearch] = useState('')
  const [sectorFilter, setSectorFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [brandFilter, setBrandFilter] = useState('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<
    Array<{ product: MasterProduct; score: number }>
  >([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isRefreshingProducts, setIsRefreshingProducts] = useState(false)
  const [productLoadMessage, setProductLoadMessage] =
    useState('Loading products...')
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean
    title?: string
    message: string
    type?: 'success' | 'error' | 'warning' | 'info'
  }>({ isOpen: false, title: 'seiGEN Commerce', message: '', type: 'success' })
  const [isDraftRecoveryModalOpen, setIsDraftRecoveryModalOpen] =
    useState(false)
  const [pendingDraft, setPendingDraft] =
    useState<Partial<MasterProduct> | null>(null)
  const [hasCheckedDraftRecovery, setHasCheckedDraftRecovery] = useState(false)
  const [draftDecisionMade, setDraftDecisionMade] = useState(false)

  const showAlert = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'success'
  ) => setAlertConfig({ isOpen: true, title: 'seiGEN Commerce', message, type })

  const editingProductDraftId =
    editingProduct && products.some(product => product.id === editingProduct.id)
      ? editingProduct.id
      : undefined

  const productDraft = useFormDraft<MasterProduct | null>({
    draftKey: getProductDraftKey(editingProductDraftId),
    formData: editingProduct,
    setFormData: setEditingProduct,
    enabled: !!editingProduct,
    saveDelayMs: 900
  })

  const isEditorOpen = !!editingProduct

  useEffect(() => {
    localStorage.removeItem(getProductDraftStorageKey())
  }, [])

  useEffect(() => {
    if (!ENABLE_PRODUCT_DRAFT_RECOVERY) {
      setIsDraftRecoveryModalOpen(false)
      setPendingDraft(null)
      setHasCheckedDraftRecovery(true)
      setDraftDecisionMade(true)
      return
    }

    if (!isEditorOpen) {
      setHasCheckedDraftRecovery(false)
      setDraftDecisionMade(false)
      setIsDraftRecoveryModalOpen(false)
      setPendingDraft(null)
      return
    }

    if (hasCheckedDraftRecovery || draftDecisionMade) return

    const savedDraft = loadProductDraftFromLocalStorage(editingProductDraftId)

    if (savedDraft) {
      setPendingDraft(savedDraft)
      setIsDraftRecoveryModalOpen(true)
    }

    setHasCheckedDraftRecovery(true)
  }, [isEditorOpen, hasCheckedDraftRecovery, draftDecisionMade])

  const loadData = async (options: { useCache?: boolean } = {}) => {
    const useCache = options.useCache !== false
    const cachedProducts = useCache ? readCachedProducts() : []

    if (cachedProducts.length > 0) {
      setProducts(cachedProducts)
      setIsLoadingData(false)
      setProductLoadMessage('Using cached product data')
    } else {
      setIsLoadingData(true)
      setProductLoadMessage('Loading products...')
    }

    setIsRefreshingProducts(true)
    if (cachedProducts.length > 0) {
      setProductLoadMessage('Refreshing from Firebase...')
    }

    try {
      const [masterProducts, taxonomySectors] = await Promise.all([
        productService.getMasterProductsOnce(),
        taxonomyService.getSectors()
      ])
      setProducts(masterProducts)
      setSectors(taxonomySectors)
      writeCachedProducts(masterProducts)
      setProductLoadMessage('Product data refreshed')
    } catch (error) {
      console.warn('Product refresh failed; using cached data.', error)
      if (cachedProducts.length > 0) {
        setProductLoadMessage(
          'Firebase is slow/unavailable. Showing cached data.'
        )
        showAlert(
          'Firebase is slow/unavailable. Showing cached product data.',
          'warning'
        )
      } else {
        setProductLoadMessage('Firebase is slow/unavailable.')
        showAlert(
          'Firebase is busy. Your draft is saved locally. Try syncing again.',
          'warning'
        )
      }
    } finally {
      setIsLoadingData(false)
      setIsRefreshingProducts(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    if (!editingProduct?.sector) {
      setCategories([])
      return
    }
    void taxonomyService
      .getCategoriesBySector(editingProduct.sector)
      .then(rows =>
        setCategories(
          Array.from(
            new Set([...rows, editingProduct.category].filter(Boolean))
          ).sort((a, b) => a.localeCompare(b))
        )
      )
  }, [editingProduct?.sector, editingProduct?.category])

  useEffect(() => {
    if (!editingProduct?.productName && !editingProduct?.barcode) {
      setDuplicates([])
      return
    }
    const handle = window.setTimeout(() => {
      void productService
        .findDuplicateMasterProducts(editingProduct)
        .then(setDuplicates)
    }, 150)
    return () => window.clearTimeout(handle)
  }, [
    editingProduct?.id,
    editingProduct?.productName,
    editingProduct?.barcode,
    editingProduct?.brand,
    editingProduct?.category
  ])

  const brands = useMemo(
    () => Array.from(new Set(products.map(p => p.brand).filter(Boolean))),
    [products]
  )
  const allCategories = useMemo(
    () =>
      Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [products]
  )

  const filteredProducts = useMemo(() => {
    const terms = search.toLowerCase().split(' ').filter(Boolean)
    return products.filter(product => {
      const matchesSearch = terms.every(term =>
        product.searchableText.includes(term)
      )
      const matchesSector =
        sectorFilter === 'all' || product.sector === sectorFilter
      const matchesCategory =
        categoryFilter === 'all' || product.category === categoryFilter
      const matchesBrand =
        brandFilter === 'all' || product.brand === brandFilter
      return matchesSearch && matchesSector && matchesCategory && matchesBrand
    })
  }, [products, search, sectorFilter, categoryFilter, brandFilter])

  const stats = useMemo(
    () => ({
      total: products.length,
      active: products.filter(p => p.status === 'active').length,
      missingImage: products.filter(p => !p.imageUrl).length,
      duplicateWatch: duplicates.length
    }),
    [products, duplicates.length]
  )

  const updateEditing = (patch: Partial<MasterProduct>) => {
    setEditingProduct(prev =>
      prev
        ? {
            ...prev,
            ...patch,
            searchableText: buildSearchableText({ ...prev, ...patch })
          }
        : prev
    )
  }

  const openEditor = (product: MasterProduct) => {
    setEditingProduct(product)
    setEditorBaseline(JSON.stringify(product))
    setIsSavingProduct(false)
    setHasAttemptedProductSave(false)
    setHasCheckedDraftRecovery(false)
    setDraftDecisionMade(false)
    setModalState('normal')
    setNewCategory('')
    setNewSector('')
  }

  const handleAdd = () => openEditor(newMasterProduct())
  const handleEdit = (product: MasterProduct) => openEditor(product)

  const hasUnsavedChanges = () =>
    !!editingProduct && JSON.stringify(editingProduct) !== editorBaseline

  const requestCloseEditor = () => {
    if (
      hasUnsavedChanges() &&
      !window.confirm('You have unsaved changes. Close Master Product Record?')
    ) {
      return
    }
    setEditingProduct(null)
    setModalState('normal')
  }

  const handleResumeDraft = () => {
    if (pendingDraft) {
      setEditingProduct(prev =>
        prev
          ? {
              ...prev,
              ...pendingDraft,
              searchableText: buildSearchableText({ ...prev, ...pendingDraft })
            }
          : prev
      )
    }

    setIsDraftRecoveryModalOpen(false)
    setDraftDecisionMade(true)
    setPendingDraft(null)
  }

  const handleDiscardDraft = () => {
    productDraft.discardDraft()
    setIsDraftRecoveryModalOpen(false)
    setDraftDecisionMade(true)
    setPendingDraft(null)
  }

  const addCustomSector = async () => {
    const value = newSector.trim()
    if (!value) return
    if (sectors.some(sector => sector.toLowerCase() === value.toLowerCase())) {
      showAlert('Sector already exists.', 'warning')
      return
    }
    const next = await taxonomyService.addSector(value)
    setSectors(next)
    updateEditing({ sector: value, category: '' })
    setNewSector('')
    void staffAuditService.logAction({
      eventType: 'RECORD_CREATED',
      module: 'settings',
      severity: 'info',
      action: `Custom sector added: ${value}`,
      recordType: 'sector',
      recordId: value
    })
  }

  const addCustomCategory = async () => {
    const value = newCategory.trim()
    if (!editingProduct?.sector) {
      showAlert('Select a sector before adding a category.', 'warning')
      return
    }
    if (!value) return
    if (
      categories.some(
        category => category.toLowerCase() === value.toLowerCase()
      )
    ) {
      showAlert('Category already exists for this sector.', 'warning')
      return
    }
    const nextCategories = await taxonomyService.addCategory(
      editingProduct.sector,
      value
    )
    setCategories(nextCategories)
    setNewCategory('')
    updateEditing({ category: value })
    void staffAuditService.logAction({
      eventType: 'RECORD_CREATED',
      module: 'settings',
      severity: 'info',
      action: `Custom product category added: ${value}`,
      recordType: 'product_category',
      recordId: `${editingProduct.sector}:${value}`
    })
  }

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || [])
    if (!files.length || !editingProduct) return
    const maxImages = getMaxImagesForListing(null, null, editingProduct)
    const currentImages = normalizeListingImages(editingProduct, maxImages)
    const remaining = maxImages - currentImages.length
    if (remaining <= 0) {
      showAlert(`This plan allows up to ${maxImages} images per listing.`, 'warning')
      event.target.value = ''
      return
    }
    try {
      const compressed = await Promise.all(
        files.slice(0, remaining).map(file => compressImage(file, 720, 0.7))
      )
      const nextImages = [
        ...currentImages,
        ...compressed.map((result, index) => ({
          url: result.base64,
          alt: editingProduct.productName || null,
          sortOrder: currentImages.length + index,
          isPrimary: currentImages.length + index === 0
        }))
      ].slice(0, maxImages)
      updateEditing({
        imageUrl: nextImages[0]?.url || '',
        images: nextImages,
        additionalImages: nextImages.slice(1).map(image => image.url)
      })
      if (files.length > remaining) {
        showAlert(`This plan allows up to ${maxImages} images per listing.`, 'warning')
      }
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : 'Image processing failed.',
        'error'
      )
    } finally {
      event.target.value = ''
    }
  }

  const removeProductImage = (url: string) => {
    if (!editingProduct) return
    const nextImages = normalizeListingImages(editingProduct).filter(
      image => image.url !== url
    )
    const normalized = nextImages.map((image, index) => ({
      ...image,
      sortOrder: index,
      isPrimary: index === 0
    }))
    updateEditing({
      imageUrl: normalized[0]?.url || '',
      images: normalized,
      additionalImages: normalized.slice(1).map(image => image.url)
    })
  }

  const handleSave = async (addAnother = false) => {
    if (!editingProduct) return false
    if (isSavingProduct) return false
    setHasAttemptedProductSave(true)
    if (
      !editingProduct.productName.trim() ||
      !editingProduct.category.trim() ||
      !editingProduct.sector.trim()
    ) {
      showAlert('Product name, category and sector are required.', 'error')
      return false
    }
    if (
      duplicates.some(d => d.score >= 90) &&
      !permissionService.canApprove('product')
    ) {
      showAlert(
        'Possible existing product detected. Link vendors to the existing master product or ask a manager to approve a new one.',
        'warning'
      )
      return false
    }
    const maxImages = getMaxImagesForListing(null, null, editingProduct)
    const listingImages = normalizeListingImages(editingProduct)
    if (listingImages.length > maxImages) {
      showAlert('Image limit exceeded for current plan.', 'error')
      return false
    }

    setIsSavingProduct(true)
    try {
      const isNew = !products.some(p => p.id === editingProduct.id)
      const productToSave: MasterProduct = {
        ...editingProduct,
        tags: editingProduct.tags || [],
        keywords: editingProduct.keywords || [],
        imageUrl: listingImages[0]?.url || editingProduct.imageUrl || '',
        images: listingImages.map((image, index) => ({
          ...image,
          sortOrder: index,
          isPrimary: index === 0
        })),
        additionalImages: listingImages.slice(1).map(image => image.url),
        searchableText: buildSearchableText(editingProduct),
        updatedAt: new Date().toISOString()
      }
      await productService.saveMasterProduct(productToSave)
      if (!navigator.onLine) {
        offlineSyncService.enqueue({
          module: 'product',
          operation: isNew ? 'create_master_product' : 'update_master_product',
          recordId: productToSave.id,
          payload: { productName: productToSave.productName }
        })
      }
      void staffAuditService.logAction({
        eventType: isNew ? 'RECORD_CREATED' : 'RECORD_UPDATED',
        module: 'product',
        severity: 'info',
        action: `${isNew ? 'Created' : 'Updated'} master product ${
          productToSave.productName
        }`,
        recordType: 'master_product',
        recordId: productToSave.id,
        recordName: productToSave.productName,
        afterSnapshot: productToSave
      })
      const optimisticProducts = isNew
        ? [...products, productToSave]
        : products.map(product =>
            product.id === productToSave.id ? productToSave : product
          )
      setProducts(optimisticProducts)
      writeCachedProducts(optimisticProducts)
      void loadData({ useCache: false })
      productDraft.clearDraft()
      localStorage.removeItem(getProductDraftStorageKey(productToSave.id))
      setHasAttemptedProductSave(false)
      setHasCheckedDraftRecovery(false)
      setDraftDecisionMade(false)
      setIsDraftRecoveryModalOpen(false)
      setPendingDraft(null)
      if (addAnother) {
        openEditor(newMasterProduct())
      } else {
        setEditingProduct(null)
        setModalState('normal')
      }
      showAlert(
        navigator.onLine
          ? 'Product saved successfully.'
          : 'Saved to this device. It will sync when internet returns.'
      )
      return true
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : 'Product save failed.',
        'error'
      )
      return false
    } finally {
      setIsSavingProduct(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const product = products.find(p => p.id === deleteId)
    await productService.deleteMasterProduct(deleteId)
    void staffAuditService.logAction({
      eventType: 'RECORD_DELETED',
      module: 'product',
      severity: 'high',
      action: `Deleted master product ${product?.productName || deleteId}`,
      recordType: 'master_product',
      recordId: deleteId,
      beforeSnapshot: product
    })
    setDeleteId(null)
    const nextProducts = products.filter(product => product.id !== deleteId)
    setProducts(nextProducts)
    writeCachedProducts(nextProducts)
    void loadData({ useCache: false })
    showAlert('Master product deleted.', 'success')
  }

  const renderEditor = () => {
    if (!editingProduct) return null
    const productNameError =
      hasAttemptedProductSave && !editingProduct.productName.trim()
        ? 'Product name is required.'
        : ''
    const sectorError =
      hasAttemptedProductSave && !editingProduct.sector.trim()
        ? 'Sector is required.'
        : ''
    const categoryError =
      hasAttemptedProductSave && !editingProduct.category.trim()
        ? 'Category is required.'
        : ''
    if (modalState === 'minimized') {
      return (
        <button
          type='button'
          onClick={() => setModalState('normal')}
          className='fixed bottom-5 right-20 z-[70] border border-brand-orange bg-brand-charcoal px-4 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-2xl'
        >
          Master Product Record
        </button>
      )
    }
    return (
      <div className='fixed inset-0 z-50 bg-brand-charcoal/70 p-3 sm:p-4 flex items-center justify-center'>
        <div
          className={`bg-white text-brand-charcoal shadow-2xl border border-stone-300 border-t-4 border-t-brand-orange flex flex-col overflow-hidden ${
            modalState === 'maximized'
              ? 'w-[98vw] h-[94vh]'
              : 'w-[794px] h-[560px] max-w-[94vw] max-h-[88vh] sm:max-w-[94vw] sm:max-h-[88vh] max-sm:w-[96vw] max-sm:h-[90vh]'
          }`}
        >
          <div className='shrink-0 border-b border-stone-200 bg-white'>
            <div className='flex items-center justify-between gap-3 px-5 py-3'>
              <div className='min-w-0'>
                <h2 className='truncate text-xs font-bold uppercase tracking-[0.24em] text-brand-charcoal'>
                  Master Product Record
                </h2>
                <p className='truncate text-[10px] font-medium uppercase text-stone-400'>
                  Global reusable product identity. Vendor price and stock live
                  in Vendor Product Offers.
                </p>
              </div>
              <div className='flex shrink-0 items-center gap-1'>
                <button
                  type='button'
                  onClick={() => setModalState('minimized')}
                  className='h-8 w-8 border border-stone-200 text-stone-500 hover:border-brand-orange hover:text-brand-orange flex items-center justify-center'
                  title='Minimize'
                >
                  <Minimize2 size={14} />
                </button>
                <button
                  type='button'
                  onClick={() =>
                    setModalState(state =>
                      state === 'maximized' ? 'normal' : 'maximized'
                    )
                  }
                  className='h-8 w-8 border border-stone-200 text-stone-500 hover:border-brand-orange hover:text-brand-orange flex items-center justify-center'
                  title={modalState === 'maximized' ? 'Restore' : 'Maximize'}
                >
                  {modalState === 'maximized' ? (
                    <Square size={13} />
                  ) : (
                    <Maximize2 size={14} />
                  )}
                </button>
                <button
                  type='button'
                  onClick={requestCloseEditor}
                  className='h-8 w-8 border border-stone-200 text-stone-500 hover:border-red-500 hover:text-red-600 flex items-center justify-center'
                  title='Close'
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          </div>

          <div className='flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-5 pb-8'>
            {duplicates.length > 0 && (
              <div className='border-2 border-orange-200 bg-orange-50 p-4'>
                <div className='flex gap-3'>
                  <AlertTriangle
                    size={18}
                    className='text-brand-orange shrink-0'
                  />
                  <div>
                    <p className='text-xs font-black uppercase text-brand-charcoal'>
                      Possible existing product detected.
                    </p>
                    <p className='text-[10px] font-bold uppercase text-stone-500'>
                      Avoid duplicates. Reuse the existing master product when
                      appropriate.
                    </p>
                  </div>
                </div>
                <div className='mt-3 grid grid-cols-1 md:grid-cols-2 gap-2'>
                  {duplicates.map(match => (
                    <button
                      key={match.product.id}
                      onClick={() => setEditingProduct(match.product)}
                      className='text-left bg-white border border-orange-200 p-3 hover:border-brand-orange'
                    >
                      <p className='text-xs font-black uppercase text-brand-charcoal'>
                        {match.product.productName}
                      </p>
                      <p className='text-[10px] font-bold uppercase text-stone-400'>
                        {match.product.brand || 'No brand'} /{' '}
                        {match.product.category} / {match.score}% match
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <label className='space-y-2 md:col-span-2'>
                <span className='text-[10px] font-bold uppercase text-stone-400'>
                  Product Name *
                </span>
                <input
                  className={inputClass}
                  value={editingProduct.productName}
                  onChange={e => updateEditing({ productName: e.target.value })}
                  placeholder='Nivea Cocoa Butter Body Cream'
                  aria-invalid={!!productNameError}
                />
                {productNameError && (
                  <p className='text-[10px] font-bold uppercase text-red-600'>
                    {productNameError}
                  </p>
                )}
              </label>
              <label className='space-y-2'>
                <span className='text-[10px] font-bold uppercase text-stone-400'>
                  Brand
                </span>
                <input
                  className={inputClass}
                  value={editingProduct.brand || ''}
                  onChange={e => updateEditing({ brand: e.target.value })}
                />
              </label>
              <label className='space-y-2'>
                <span className='text-[10px] font-bold uppercase text-stone-400'>
                  Barcode
                </span>
                <input
                  className={inputClass}
                  value={editingProduct.barcode || ''}
                  onChange={e => updateEditing({ barcode: e.target.value })}
                />
              </label>
              <label className='space-y-2'>
                <span className='text-[10px] font-bold uppercase text-stone-400'>
                  Sector *
                </span>
                <SearchableComboBox
                  value={editingProduct.sector || ''}
                  options={sectors}
                  getOptionLabel={sector => sector}
                  getOptionValue={sector => sector}
                  getOptionSearchText={sector => sector}
                  onSelect={sector =>
                    updateEditing({ sector: sector || '', category: '' })
                  }
                  placeholder='Search or select sector'
                  allowAddNew
                  onAddNew={sector => {
                    setNewSector(sector)
                    void taxonomyService.addSector(sector).then(next => {
                      setSectors(next)
                      updateEditing({ sector, category: '' })
                    })
                  }}
                />
                {sectorError && (
                  <p className='text-[10px] font-bold uppercase text-red-600'>
                    {sectorError}
                  </p>
                )}
                <div className='flex gap-2'>
                  <input
                    value={newSector}
                    onChange={e => setNewSector(e.target.value)}
                    className='min-w-0 flex-1 border border-stone-200 p-2 text-[10px] uppercase outline-none focus:border-brand-orange'
                    placeholder='+ Add New Sector'
                  />
                  <button
                    type='button'
                    onClick={() => void addCustomSector()}
                    className='border border-brand-orange px-3 text-[10px] font-bold uppercase text-brand-orange'
                  >
                    Add
                  </button>
                </div>
              </label>
              <label className='space-y-2'>
                <span className='text-[10px] font-bold uppercase text-stone-400'>
                  Category *
                </span>
                <select
                  className={inputClass}
                  value={editingProduct.category || ''}
                  onChange={e => {
                    if (e.target.value === '__add_new__') {
                      setNewCategory('')
                      updateEditing({ category: '' })
                      return
                    }
                    updateEditing({ category: e.target.value })
                  }}
                >
                  <option value=''>Select category...</option>
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                  <option value='__add_new__'>+ Add New Category</option>
                </select>
                {categoryError && (
                  <p className='text-[10px] font-bold uppercase text-red-600'>
                    {categoryError}
                  </p>
                )}
                <div className='flex gap-2'>
                  <input
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className='min-w-0 flex-1 border border-stone-200 p-2 text-[10px] uppercase outline-none focus:border-brand-orange'
                    placeholder='+ Add New Category'
                  />
                  <button
                    type='button'
                    onClick={() => void addCustomCategory()}
                    className='border border-brand-orange px-3 text-[10px] font-bold uppercase text-brand-orange'
                  >
                    Add
                  </button>
                </div>
              </label>
              <label className='space-y-2'>
                <span className='text-[10px] font-bold uppercase text-stone-400'>
                  Standard SKU
                </span>
                <input
                  className={inputClass}
                  value={editingProduct.standardSku || ''}
                  onChange={e => updateEditing({ standardSku: e.target.value })}
                />
              </label>
              <label className='space-y-2'>
                <span className='text-[10px] font-bold uppercase text-stone-400'>
                  Unit
                </span>
                <input
                  className={inputClass}
                  value={editingProduct.unit || ''}
                  onChange={e => updateEditing({ unit: e.target.value })}
                />
              </label>
              <label className='space-y-2'>
                <span className='text-[10px] font-bold uppercase text-stone-400'>
                  Tags
                </span>
                <input
                  className={inputClass}
                  value={(editingProduct.tags || []).join(', ')}
                  onChange={e =>
                    updateEditing({
                      tags: e.target.value
                        .split(',')
                        .map(tag => tag.trim())
                        .filter(Boolean)
                    })
                  }
                  placeholder='body lotion, skin care'
                />
              </label>
              <label className='space-y-2'>
                <span className='text-[10px] font-bold uppercase text-stone-400'>
                  Keywords
                </span>
                <input
                  className={inputClass}
                  value={(editingProduct.keywords || []).join(', ')}
                  onChange={e =>
                    updateEditing({
                      keywords: e.target.value
                        .split(',')
                        .map(keyword => keyword.trim())
                        .filter(Boolean)
                    })
                  }
                  placeholder='nivea cream, cocoa butter'
                />
              </label>
              <label className='space-y-2 md:col-span-2'>
                <span className='text-[10px] font-bold uppercase text-stone-400'>
                  Description
                </span>
                <textarea
                  rows={4}
                  className={`${inputClass} normal-case`}
                  value={editingProduct.description || ''}
                  onChange={e => updateEditing({ description: e.target.value })}
                />
              </label>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              {(() => {
                const maxImages = getMaxImagesForListing(
                  null,
                  null,
                  editingProduct
                )
                const listingImages = normalizeListingImages(
                  editingProduct,
                  maxImages
                )
                const limitReached = listingImages.length >= maxImages
                return (
                  <>
              <div className='border-2 border-dashed border-stone-200 p-8 text-center relative'>
                <input
                  type='file'
                  accept='image/*'
                  multiple
                  className='absolute inset-0 opacity-0 cursor-pointer'
                  disabled={limitReached}
                  onChange={handleImageUpload}
                />
                <Upload size={28} className='mx-auto text-stone-300 mb-3' />
                <p className='text-[10px] font-black uppercase text-stone-400'>
                  Upload Master Product Image
                </p>
                <p className='mt-2 text-[10px] font-black uppercase text-brand-orange'>
                  Images {listingImages.length}/{maxImages}
                </p>
                {limitReached && (
                  <p className='mt-2 text-[10px] font-bold uppercase text-orange-700'>
                    This plan allows up to {maxImages} images per listing.
                  </p>
                )}
              </div>
              <div className='border border-stone-200 p-4'>
                {listingImages.length > 0 ? (
                  <>
                    <img
                      src={listingImages[0].url}
                      alt='Master product'
                      className='h-44 w-full object-contain bg-stone-50'
                    />
                    <div className='mt-3 grid grid-cols-3 gap-2'>
                      {listingImages.map(image => (
                        <button
                          key={image.url}
                          type='button'
                          onClick={() => removeProductImage(image.url)}
                          className='relative h-16 border border-stone-200 bg-stone-50'
                          title='Remove image'
                        >
                          <img
                            src={image.url}
                            alt=''
                            className='h-full w-full object-cover'
                          />
                          <span className='absolute right-1 top-1 bg-white p-0.5 text-stone-700'>
                            <X size={10} />
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className='mt-2 text-[10px] font-bold uppercase text-stone-400'>
                      Primary image plus gallery embedded for listing export
                    </p>
                  </>
                ) : (
                  <div className='h-44 flex items-center justify-center bg-stone-50 text-stone-300'>
                    <ImageIcon size={36} />
                  </div>
                )}
              </div>
                  </>
                )
              })()}
            </div>

            <div className='grid grid-cols-2 md:grid-cols-4 gap-2'>
              {PRODUCT_STATUSES.map(status => (
                <button
                  key={status}
                  onClick={() => updateEditing({ status })}
                  className={`border-2 p-3 text-[10px] font-black uppercase ${
                    editingProduct.status === status
                      ? 'border-brand-charcoal bg-brand-charcoal text-white'
                      : 'border-stone-200 bg-white text-stone-400'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
          <div className='sticky bottom-0 z-10 shrink-0 p-4 bg-white border-t border-stone-200 flex flex-col sm:flex-row gap-3'>
            <SecondaryButton
              type='button'
              className='flex-1'
              onClick={requestCloseEditor}
              disabled={isSavingProduct}
            >
              Cancel
            </SecondaryButton>
            <SecondaryButton
              type='button'
              className='flex-1'
              onClick={() => void handleSave(true)}
              disabled={isSavingProduct}
            >
              Save & Add Another
            </SecondaryButton>
            <PrimaryButton
              type='button'
              className='flex-1'
              onClick={() => void handleSave(false)}
              disabled={isSavingProduct}
            >
              {isSavingProduct ? (
                <Loader2 size={14} className='mr-2 animate-spin' />
              ) : (
                <Save size={14} className='mr-2' />
              )}{' '}
              {isSavingProduct
                ? 'Saving Product...'
                : navigator.onLine
                ? 'Save Product'
                : 'Save Locally'}
            </PrimaryButton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-8 pb-20'>
      <BrandedAlertModal
        {...alertConfig}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />
      {ENABLE_PRODUCT_DRAFT_RECOVERY && isDraftRecoveryModalOpen && (
        <div className='fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4'>
          <div className='w-full max-w-md border-2 border-brand-orange bg-white p-5 shadow-2xl'>
            <h3 className='text-sm font-black uppercase text-brand-charcoal'>
              Unsaved draft found
            </h3>
            <p className='mt-2 text-xs font-bold text-stone-600'>
              Resume or discard the Master Product Record draft saved on this
              device?
            </p>
            <div className='mt-5 flex gap-3'>
              <PrimaryButton
                type='button'
                className='flex-1'
                onClick={handleResumeDraft}
              >
                Resume
              </PrimaryButton>
              <SecondaryButton
                type='button'
                className='flex-1'
                onClick={handleDiscardDraft}
              >
                Discard
              </SecondaryButton>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={!!deleteId}
        title='Delete Master Product'
        message='This removes the master product record. Existing vendor offers for this product will no longer join correctly.'
        confirmLabel='Delete'
        variant='danger'
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      <div className='grid grid-cols-1 md:grid-cols-4 gap-5'>
        <StatCard label='Master Products' value={stats.total} icon={Package} />
        <StatCard
          label='Active'
          value={stats.active}
          icon={Layers}
          variant='success'
        />
        <StatCard
          label='Missing Images'
          value={stats.missingImage}
          icon={ImageIcon}
          variant={stats.missingImage > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label='Duplicate Watch'
          value={stats.duplicateWatch}
          icon={AlertTriangle}
          variant={stats.duplicateWatch > 0 ? 'error' : 'neutral'}
        />
      </div>

      <DataPanel
        title='Master Product Library'
        subtitle='Create products once globally. Vendors attach price, stock and location through product offers.'
        actions={
          permissionService.canCreate('productManagement') && (
            <PrimaryButton onClick={handleAdd}>
              <Plus size={14} className='mr-2' /> New Master Product
            </PrimaryButton>
          )
        }
      >
        <div className='border-b border-stone-200 bg-white px-5 py-3'>
          <p className='flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-500'>
            {isRefreshingProducts && (
              <Loader2 size={12} className='animate-spin text-brand-orange' />
            )}
            {productLoadMessage}
          </p>
        </div>
        <div className='p-5 border-b border-stone-200 grid grid-cols-1 md:grid-cols-5 gap-3 bg-stone-50'>
          <SearchInput
            className='md:col-span-2'
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Search name, brand, barcode, keywords...'
          />
          <SearchableComboBox
            value={sectorFilter === 'all' ? '' : sectorFilter}
            options={sectors}
            getOptionLabel={sector => sector}
            getOptionValue={sector => sector}
            getOptionSearchText={sector => sector}
            placeholder='All sectors'
            onSelect={sector => setSectorFilter(sector || 'all')}
          />
          <select
            className={inputClass}
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value='all'>All categories</option>
            {allCategories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={brandFilter}
            onChange={e => setBrandFilter(e.target.value)}
          >
            <option value='all'>All brands</option>
            {brands.map(brand => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </div>
        <TablePanel
          title='Product Identity Registry'
          headers={[
            'Image',
            'Product',
            'Brand',
            'Category',
            'Sector',
            'Barcode / SKU',
            'Status',
            'Actions'
          ]}
        >
          {isLoadingData && products.length === 0 && (
            <tr>
              <td colSpan={8} className='p-10'>
                <div className='flex flex-col items-center justify-center text-stone-400'>
                  <Loader2 className='mb-4 h-8 w-8 animate-spin' />
                  <p className='text-xs font-bold uppercase tracking-widest'>
                    Loading products...
                  </p>
                </div>
              </td>
            </tr>
          )}
          {!isLoadingData && filteredProducts.map(product => (
            <tr key={product.id} className='hover:bg-stone-50'>
              <td className='px-6 py-4'>
                <div className='h-12 w-12 border border-stone-200 bg-stone-50 flex items-center justify-center'>
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt=''
                      className='h-full w-full object-cover'
                    />
                  ) : (
                    <PackageSearch size={18} className='text-stone-300' />
                  )}
                </div>
              </td>
              <td className='px-6 py-4'>
                <p className='text-xs font-black uppercase text-brand-charcoal'>
                  {product.productName}
                </p>
                <p className='text-[10px] font-bold uppercase text-stone-400'>
                  {product.tags?.slice(0, 3).join(', ') || 'No tags'}
                </p>
              </td>
              <td className='px-6 py-4 text-xs font-bold uppercase'>
                {product.brand || '-'}
              </td>
              <td className='px-6 py-4 text-xs font-bold uppercase'>
                {product.category || '-'}
              </td>
              <td className='px-6 py-4 text-xs font-bold uppercase'>
                {product.sector || '-'}
              </td>
              <td className='px-6 py-4 text-[10px] font-mono text-stone-500'>
                <p>{product.barcode || 'No barcode'}</p>
                <p>{product.standardSku || 'No SKU'}</p>
              </td>
              <td className='px-6 py-4'>
                <StatusBadge
                  status={product.status}
                  variant={product.status === 'active' ? 'success' : 'neutral'}
                />
              </td>
              <td className='px-6 py-4'>
                <div className='flex gap-2'>
                  <SecondaryButton
                    size='sm'
                    onClick={() => handleEdit(product)}
                  >
                    <Edit3 size={12} className='mr-1' /> Edit
                  </SecondaryButton>
                  {permissionService.canDelete('productManagement') && (
                    <button
                      className='p-2 border border-stone-200 text-stone-400 hover:border-red-500 hover:text-red-600'
                      onClick={() => setDeleteId(product.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {!isLoadingData && filteredProducts.length === 0 && (
            <tr>
              <td colSpan={8} className='p-10'>
                <EmptyState
                  icon={Search}
                  title='No Master Products Found'
                  description='Create the first reusable product or adjust your filters.'
                />
              </td>
            </tr>
          )}
        </TablePanel>
      </DataPanel>

      <DataPanel
        title='Architecture Note'
        className='border-t-4 border-t-brand-orange'
      >
        <div className='p-5 grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div className='border border-stone-200 p-4'>
            <Package size={18} className='text-brand-orange mb-2' />
            <p className='text-xs font-black uppercase'>Master Product</p>
            <p className='text-[10px] font-bold text-stone-500 mt-1'>
              Identity, brand, category, images, barcode and search metadata.
            </p>
          </div>
          <div className='border border-stone-200 p-4'>
            <Tag size={18} className='text-brand-orange mb-2' />
            <p className='text-xs font-black uppercase'>Vendor Offer</p>
            <p className='text-[10px] font-bold text-stone-500 mt-1'>
              Price, stock, branch, publish status, delivery and vendor notes.
            </p>
          </div>
          <div className='border border-stone-200 p-4'>
            <Archive size={18} className='text-brand-orange mb-2' />
            <p className='text-xs font-black uppercase'>Migration Safe</p>
            <p className='text-[10px] font-bold text-stone-500 mt-1'>
              Old vendor-bound products are converted into one master plus many
              offers.
            </p>
          </div>
        </div>
      </DataPanel>

      {renderEditor()}
    </div>
  )
}
