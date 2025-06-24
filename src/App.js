import React, { useState, useEffect, createContext, useContext } from 'react';

// --- IMPORTANT: Replace with your deployed Google Apps Script Web App URL ---
// After deploying your Google Apps Script (from Part 2), copy its "Web app URL" and paste it here.
// MAKE SURE THIS IS THE LATEST URL AFTER YOUR CODE.GS REDEPLOYMENT!
const GOOGLE_SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbxrnJuhwPEl9mgqEyJkCNcxnHG-GdVwtUDbOmXOMsRLAK-g4QqygWzp1LEw0BXBo_2a/exec';


// --- Settings Context ---
// This context will manage global app settings (background, colors, fonts, layout)
const SettingsContext = createContext();

// Settings Provider Component
const SettingsProvider = ({ children, callApi }) => {
    const defaultSettings = {
        backgroundUrl: 'https://images.pexels.com/photos/262048/pexels-photo-262048.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        primaryColor: '#007BFF',
        secondaryColor: '#28a745',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        baseFontSizePx: 16,
        categoryGridColumns: 3
    };
    const [settings, setSettings] = useState(defaultSettings);
    const [loadingSettings, setLoadingSettings] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                // Fetch settings using a POST request with action 'getSettings'
                const data = await callApi('getSettings');
                if (data.success && data.settings) {
                    setSettings(prev => ({
                        ...prev, // Keep defaults if specific settings aren't returned
                        ...data.settings,
                        baseFontSizePx: parseFloat(data.settings.baseFontSizePx) || prev.baseFontSizePx,
                        categoryGridColumns: parseInt(data.settings.categoryGridColumns) || prev.categoryGridColumns
                    }));
                }
            } catch (error) {
                console.error("Failed to load settings:", error);
                // Optionally show a message to the user that settings couldn't be loaded
            } finally {
                setLoadingSettings(false);
            }
        };
        fetchSettings();
    }, [callApi]);

    const updateSettingsInBackend = async (newSettings) => {
        try {
            const data = await callApi('updateSettings', { settings: newSettings });
            if (data.success) {
                setSettings(prev => ({
                    ...prev,
                    ...newSettings,
                    baseFontSizePx: parseFloat(newSettings.baseFontSizePx) || prev.baseFontSizePx,
                    categoryGridColumns: parseInt(newSettings.categoryGridColumns) || prev.categoryGridColumns
                }));
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.message || 'Failed to update settings.' };
            }
        } catch (error) {
            console.error("Error updating settings:", error);
            return { success: false, message: error.message || 'Network error updating settings.' };
        }
    };

    if (loadingSettings) {
        // You might want a loading spinner here
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: 20, color: '#555' }}>Loading app settings...</div>;
    }

    return (
        <SettingsContext.Provider value={{ settings, updateSettingsInBackend }}>
            {children}
        </SettingsContext.Provider>
    );
};


// --- Main App Component ---
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('Dashboard');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [initialCategory, setInitialCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Function to make API calls to Google Apps Script
  const callApi = async (action, payload = {}) => {
    try {
      const response = await fetch(GOOGLE_SHEETS_API_URL, {
        method: 'POST', // Use POST for all write operations (add, delete, clear, update, settings)
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.message || data.error || 'API call failed');
      }
      return data;
    } catch (error) {
      console.error('Error calling Apps Script API:', error);
      throw error; // Re-throw to be caught by the screen components
    }
  };

  // Function to fetch all products from Google Sheet (still uses GET)
  const fetchProducts = async () => {
    try {
      const response = await fetch(GOOGLE_SHEETS_API_URL); // GET request
      const products = await response.json();
      if (!response.ok || products.error) {
         throw new Error(products.error || 'Failed to fetch products');
      }
      return products;
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  };

  const navigateTo = (screen, category = null, product = null) => {
    setInitialCategory(category);
    setSelectedProduct(product);
    setCurrentScreen(screen);
  };

  // Replace window.confirm with CustomAlert logic
  const [confirmMessage, setConfirmMessage] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const showConfirm = (message, action) => {
      setConfirmMessage(message);
      setConfirmAction(() => action);
  };

  const handleConfirm = () => {
      if (confirmAction) {
          confirmAction();
      }
      setConfirmMessage(null);
      setConfirmAction(null);
  };

  const handleCancelConfirm = () => {
      setConfirmMessage(null);
      setConfirmAction(null);
  };


  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  // --- Screen Rendering Logic ---
  const renderContent = () => {
    switch (currentScreen) {
        case 'Dashboard':
            return <DashboardScreen
                      setCurrentScreen={navigateTo}
                      setSearchTerm={setSearchTerm}
                    />;
        case 'AddProduct':
            return <AddProductScreen
                      setCurrentScreen={navigateTo}
                      initialCategory={initialCategory}
                      callApi={callApi}
                    />;
        case 'Settings':
            return <AppSettingsScreen
                      setCurrentScreen={navigateTo}
                      fetchProducts={fetchProducts}
                      callApi={callApi}
                      showConfirm={showConfirm}
                    />;
        case 'Search':
            return <SearchScreen
                      searchTerm={searchTerm}
                      onProductSelect={setSelectedProduct}
                      setCurrentScreen={navigateTo}
                      fetchProducts={fetchProducts}
                    />;
        case 'ProductDetail':
            // If navigating directly to ProductDetail (e.g., from search), product must be set
            if (!selectedProduct) return <DashboardScreen setCurrentScreen={navigateTo} setSearchTerm={setSearchTerm} />;
            return <ProductDetailScreen
                      product={selectedProduct}
                      onBack={() => setCurrentScreen(`ProductList-${selectedProduct.category}`)} // Go back to category
                      onEdit={() => setCurrentScreen('EditProduct', null, selectedProduct)} // Pass selected product to edit
                    />;
        case 'EditProduct':
             if (!selectedProduct) return <DashboardScreen setCurrentScreen={navigateTo} setSearchTerm={setSearchTerm} />;
             return <EditProductScreen
                       product={selectedProduct}
                       setCurrentScreen={navigateTo}
                       callApi={callApi}
                       onBack={() => setCurrentScreen('ProductDetail', null, selectedProduct)}
                    />;
        default:
            if (currentScreen.startsWith('ProductList-')) {
                const category = currentScreen.split('-')[1];
                return <ProductListScreen
                          category={category}
                          setCurrentScreen={navigateTo}
                          onProductSelect={setSelectedProduct}
                          fetchProducts={fetchProducts}
                       />;
            }
            return <DashboardScreen setCurrentScreen={navigateTo} setSearchTerm={setSearchTerm}/>;
    }
  };

  return (
    <SettingsProvider callApi={callApi}>
        <div style={baseStyles.safeArea}>
            {renderContent()}
            <CustomConfirm
                message={confirmMessage}
                onConfirm={handleConfirm}
                onCancel={handleCancelConfirm}
            />
        </div>
    </SettingsProvider>
  );
}

// --- Login Screen ---
const LoginScreen = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = () => {
        if (username === 'Admin' && password === 'MarketingComfort25') {
            onLoginSuccess();
        } else {
            setError('Invalid username or password');
        }
    };

    return (
        <div style={loginStyles.container}>
            <p style={loginStyles.title}>Comfort Digital Catalogue</p>
            {error && <p style={loginStyles.errorText}>{error}</p>}
            <input
                style={loginStyles.input}
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
            />
            <input
                style={loginStyles.input}
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <button style={loginStyles.button} onClick={handleLogin}>
                Enter
            </button>
        </div>
    );
};

// --- Reusable Custom Alert Modal (renamed to CustomConfirm for clarity) ---
const CustomConfirm = ({ message, onConfirm, onCancel }) => {
    if (!message) return null;
    return (
        <div style={modalStyles.overlay}>
            <div style={modalStyles.content}>
                <p style={modalStyles.text}>{message}</p>
                <div style={modalStyles.buttonContainer}>
                    <button style={modalStyles.confirmButton} onClick={onConfirm}>Yes</button>
                    <button style={modalStyles.cancelButton} onClick={onCancel}>Cancel</button>
                </div>
            </div>
        </div>
    );
};


// --- Dashboard Screen ---
const DashboardScreen = ({ setCurrentScreen, setSearchTerm }) => {
    const { settings } = useContext(SettingsContext);
    const categories = ['Bedding', 'Towels', 'Bathroom Amenities', 'Guest Supplies', 'Housekeeping', 'Lobby', 'Leather Accessories', 'Safety Boxes', 'Restaurant Supplies', 'Hospital Supplies', 'Spa Supplies', 'Eco-Friendly', 'S-Collection'];
    const [localSearch, setLocalSearch] = useState('');

    const handleSearch = () => {
      if(localSearch.trim()){
        setSearchTerm(localSearch.trim());
        setCurrentScreen('Search');
      }
    }

    const dashboardDynamicStyles = {
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${settings.backgroundUrl})`,
        fontFamily: settings.fontFamily,
        fontSize: `${settings.baseFontSizePx}px`
    };

    return (
        <div style={{ ...dashboardStyles.container, ...dashboardDynamicStyles }}>
            <div style={dashboardStyles.header}>
              <button onClick={() => setCurrentScreen('Settings')} style={{...dashboardStyles.settingsButton, color: settings.primaryColor}}>⚙️</button>
              <h1 style={dashboardStyles.headerTitle}>Comfort Digital Catalogue</h1>
            </div>

            <div style={dashboardStyles.searchContainer}>
                <input
                  type="text"
                  placeholder="Search for a product..."
                  style={dashboardStyles.searchInput}
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button style={{...dashboardStyles.searchButton, backgroundColor: settings.primaryColor}} onClick={handleSearch}>Search</button>
            </div>

            <div style={dashboardStyles.mainContent}>
              <p style={dashboardStyles.subHeaderTitle}>Browse Categories</p>
              <div style={{
                  ...dashboardStyles.categoryGrid,
                  gridTemplateColumns: `repeat(${settings.categoryGridColumns}, minmax(150px, 1fr))`
              }}>
                  {categories.map(category => (
                      <button key={category} style={{
                           ...dashboardStyles.categoryButton,
                           backgroundColor: `rgba(255, 255, 255, 0.1)`, // Slightly transparent background
                           borderColor: settings.primaryColor,
                           color: settings.primaryColor,
                           fontSize: `${settings.baseFontSizePx * 1.1}px` // Slightly larger than base
                        }} onClick={() => setCurrentScreen(`ProductList-${category}`)}>
                          {category}
                      </button>
                  ))}
              </div>
              <button style={{...dashboardStyles.addProductButton, backgroundColor: settings.secondaryColor}} onClick={() => setCurrentScreen('AddProduct', null)}>
                  + Add New Product
              </button>
            </div>
        </div>
    );
};

// --- Product List Screen ---
const ProductListScreen = ({ category, setCurrentScreen, onProductSelect, fetchProducts }) => {
    const { settings } = useContext(SettingsContext);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const getProducts = async () => {
            setLoading(true);
            setError(null);
            try {
                const allProducts = await fetchProducts();
                const categoryProducts = allProducts.filter(p => p.category === category);
                setProducts(categoryProducts);
            } catch (err) {
                setError(err.message || 'Failed to load products.');
            } finally {
                setLoading(false);
            }
        };
        getProducts();
    }, [category, fetchProducts]);

    const productListDynamicStyles = {
        fontFamily: settings.fontFamily,
        fontSize: `${settings.baseFontSizePx}px`
    };

    if (loading) {
        return <div style={{...baseStyles.container, ...productListDynamicStyles, justifyContent: 'center', color: '#555'}}>Loading products...</div>;
    }

    if (error) {
        return <div style={{...baseStyles.container, ...productListDynamicStyles, justifyContent: 'center', color: 'red'}}>Error: {error}</div>;
    }

    return (
        <div style={{...baseStyles.container, ...productListDynamicStyles, justifyContent:'flex-start'}}>
            <button style={{...baseStyles.backButton, color: settings.primaryColor}} onClick={() => setCurrentScreen('Dashboard')}>
                ← Back to Dashboard
            </button>
            <div style={productListStyles.productListHeader}>
                <h2 style={{...productListStyles.title, color: settings.primaryColor}}>{category}</h2>
                <button style={{...productListStyles.addProductInCategoryButton, backgroundColor: settings.secondaryColor}} onClick={() => setCurrentScreen('AddProduct', category)}>+ Add Product</button>
            </div>
            {products.length === 0 ? (
                <p style={productListStyles.noProductsText}>No products found in this category.</p>
            ) : (
                <div style={productListStyles.productGridContainer}>
                    {products.map(product => (
                        <div key={product.id} style={productListStyles.productCard} onClick={() => onProductSelect(product)}>
                            {/* Display the first image as thumbnail */}
                            <div style={productListStyles.productImage}>
                                <img
                                    src={product.imageUrl && product.imageUrl.length > 0 ? product.imageUrl[0] : 'https://placehold.co/150x150/EEE/31343C?text=No+Image'}
                                    alt={product.name}
                                    style={productListStyles.productImageTag}
                                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x150/EEE/31343C?text=No+Image'; }}
                                />
                            </div>
                            <div style={productListStyles.productDetails}>
                                <p style={productListStyles.productName}>{product.name}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Product Detail Screen ---
const ProductDetailScreen = ({ product, onBack, onEdit }) => {
    const { settings } = useContext(SettingsContext);
    const imagesToDisplay = Array.isArray(product.imageUrl) ? product.imageUrl : [];

    const productDetailDynamicStyles = {
        fontFamily: settings.fontFamily,
        fontSize: `${settings.baseFontSizePx}px`
    };

    return (
        <div style={{...baseStyles.container, ...productDetailDynamicStyles, justifyContent: 'flex-start'}}>
             <button style={{...baseStyles.backButton, color: settings.primaryColor}} onClick={onBack}>
                ← Back to List
            </button>
            <button style={{...productDetailStyles.editButton, backgroundColor: settings.primaryColor}} onClick={onEdit}>
                Edit Product
            </button>
            <div style={productDetailStyles.contentWrapper}>
                {imagesToDisplay.length > 0 ? (
                    <div style={productDetailStyles.imageGallery}>
                        {imagesToDisplay.map((imgSrc, index) => (
                            <img
                                key={index}
                                src={imgSrc}
                                alt={`${product.name} image ${index + 1}`}
                                style={productDetailStyles.detailImage}
                                onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/1400x1400/EEE/31343C?text=No+Image'; }}
                            />
                        ))}
                    </div>
                ) : (
                    <img src={'https://placehold.co/1400x1400/EEE/31343C?text=No+Image'} alt="No Image" style={productDetailStyles.detailImage} />
                )}
                <h2 style={productDetailStyles.detailName}>{product.name}</h2>
                <p style={{...productDetailStyles.detailPrice, color: settings.secondaryColor}}>${parseFloat(product.price).toFixed(2)}</p>
                <p style={productDetailStyles.detailDescription}>{product.description}</p>
            </div>
        </div>
    );
};

// --- Add Product Screen ---
const AddProductScreen = ({ setCurrentScreen, initialCategory, callApi }) => {
    const { settings } = useContext(SettingsContext);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState(initialCategory || 'Bedding');
    const [imageUrlsInput, setImageUrlsInput] = useState('');
    const [alertMessage, setAlertMessage] = useState('');
    const [selectedFiles, setSelectedFiles] = useState([]); // For file objects

    const categories = ['Bedding', 'Towels', 'Bathroom Amenities', 'Guest Supplies', 'Housekeeping', 'Lobby', 'Leather Accessories', 'Safety Boxes', 'Restaurant Supplies', 'Hospital Supplies', 'Spa Supplies', 'Eco-Friendly', 'S-Collection'];

    const handleFileChange = (e) => {
        setSelectedFiles(Array.from(e.target.files));
    };

    // This function would conceptually handle uploading files to a service like Cloudinary
    // For this demonstration, it just returns local object URLs for preview.
    // In a real app, this would be an async call to an external image hosting API.
    const getFilePreviews = (files) => {
        return files.map(file => URL.createObjectURL(file));
    };

    const handleSaveProduct = async () => {
        if (!name || !price || !category) {
            setAlertMessage('Please fill in Product Name, Price, and Category.');
            return;
        }

        // Combine manually entered URLs with conceptual "uploaded" file URLs
        let finalImageUrls = [];
        if (imageUrlsInput.trim()) {
            finalImageUrls = imageUrlsInput.split(',').map(url => url.trim()).filter(url => url !== '');
        }
        // If files were selected, we would actually upload them here and get their public URLs.
        // For now, we'll just show the local previews.
        if (selectedFiles.length > 0) {
            // Placeholder: In a real app, call a service like Cloudinary here to upload files
            // and get actual public URLs.
            // Example: const uploadedCloudinaryUrls = await uploadImagesToCloudinary(selectedFiles);
            // finalImageUrls = [...finalImageUrls, ...uploadedCloudinaryUrls];
            setAlertMessage("Image upload functionality needs a real backend/service (e.g., Cloudinary) to get public URLs for saving. Currently, only URLs you paste will be saved.");
            // For now, we won't add local object URLs to the saved data as they're not persistent.
        }


        try {
            const newProduct = { name, description, price: parseFloat(price), category, imageUrl: finalImageUrls };
            await callApi('add', { product: newProduct });
            setAlertMessage('Product added successfully!');
            // Clear inputs for new product
            setName('');
            setDescription('');
            setPrice('');
            setCategory(initialCategory || 'Bedding');
            setImageUrlsInput('');
            setSelectedFiles([]);
        } catch (error) {
            setAlertMessage(`Failed to add product: ${error.message}`);
        }
    };

    const closeAlert = () => {
        if(alertMessage.includes('successfully!')){
            setCurrentScreen('Dashboard');
        }
        setAlertMessage('');
    }

    const addProductDynamicStyles = {
        fontFamily: settings.fontFamily,
        fontSize: `${settings.baseFontSizePx}px`
    };

    const currentImagePreviews = [...getFilePreviews(selectedFiles), ...imageUrlsInput.split(',').map(url => url.trim()).filter(url => url !== '')];

    return (
        <div style={{...baseStyles.container, ...addProductDynamicStyles, justifyContent: 'flex-start', overflowY: 'auto'}}>
            <CustomConfirm message={alertMessage} onConfirm={closeAlert} onCancel={closeAlert} />
            <button style={{...baseStyles.backButton, color: settings.primaryColor}} onClick={() => setCurrentScreen('Dashboard')}>
                ← Back to Dashboard
            </button>
            <h2 style={addProductStyles.title}>Add a New Product</h2>

            <input style={addProductStyles.input} placeholder="Product Name" value={name} onChange={(e) => setName(e.target.value)} />
            <textarea style={{...addProductStyles.input, height: 80}} placeholder="Product Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <input style={addProductStyles.input} placeholder="Price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />

            <p style={addProductStyles.label}>Upload Images (or paste URLs)</p>
            <input
                type="file"
                multiple
                onChange={handleFileChange}
                accept="image/*"
                style={addProductStyles.fileInput}
            />
            <textarea
                style={{...addProductStyles.input, height: 80, marginTop: 10}}
                placeholder="Or paste Image URLs (separate with commas)"
                value={imageUrlsInput}
                onChange={(e) => setImageUrlsInput(e.target.value)}
            />

            <p style={addProductStyles.label}>Category</p>
            <div style={addProductStyles.categoryPickerContainer}>
                {categories.map(cat => (
                     <button
                        key={cat}
                        style={category === cat ? {...addProductStyles.categoryPickerButton, backgroundColor: settings.primaryColor, borderColor: settings.primaryColor, color: '#fff'} : addProductStyles.categoryPickerButton}
                        onClick={() => setCategory(cat)}
                     >
                        {cat}
                     </button>
                ))}
            </div>

            {currentImagePreviews.length > 0 && <p style={addProductStyles.label}>Image Previews:</p>}
            <div style={addProductStyles.imagePreviewContainer}>
                {currentImagePreviews.map((url, index) => (
                    <div key={index} style={addProductStyles.previewImageWrapper}>
                        <img
                            src={url}
                            alt={`Preview ${index + 1}`}
                            style={addProductStyles.previewImage}
                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/100x100/EEE/31343C?text=No+Image'; }}
                        />
                    </div>
                ))}
            </div>
            <button style={{...addProductStyles.button, backgroundColor: settings.secondaryColor}} onClick={handleSaveProduct}>Save Product</button>
        </div>
    );
};

// --- Edit Product Screen (New) ---
const EditProductScreen = ({ product, setCurrentScreen, callApi, onBack }) => {
    const { settings } = useContext(SettingsContext);
    const [name, setName] = useState(product.name);
    const [description, setDescription] = useState(product.description);
    const [price, setPrice] = useState(product.price);
    const [category, setCategory] = useState(product.category);
    // Convert existing imageUrl array to comma-separated string for editing
    const [imageUrlsInput, setImageUrlsInput] = useState(Array.isArray(product.imageUrl) ? product.imageUrl.join(', ') : '');
    const [alertMessage, setAlertMessage] = useState('');
    const [selectedFiles, setSelectedFiles] = useState([]); // For new file uploads

    const categories = ['Bedding', 'Towels', 'Bathroom Amenities', 'Guest Supplies', 'Housekeeping', 'Lobby', 'Leather Accessories', 'Safety Boxes', 'Restaurant Supplies', 'Hospital Supplies', 'Spa Supplies', 'Eco-Friendly', 'S-Collection'];

    const handleFileChange = (e) => {
        setSelectedFiles(Array.from(e.target.files));
    };

    const getFilePreviews = (files) => {
        return files.map(file => URL.createObjectURL(file));
    };

    const handleUpdateProduct = async () => {
        if (!name || !price || !category) {
            setAlertMessage('Please fill in Product Name, Price, and Category.');
            return;
        }

        let finalImageUrls = [];
        if (imageUrlsInput.trim()) {
            finalImageUrls = imageUrlsInput.split(',').map(url => url.trim()).filter(url => url !== '');
        }

        if (selectedFiles.length > 0) {
            setAlertMessage("Image file upload functionality needs a real backend/service (e.g., Cloudinary) to get public URLs for saving. Currently, only URLs you paste will be saved.");
            // In a real app, upload files here and get their public URLs, then add to finalImageUrls.
        }

        try {
            const updatedProduct = {
                id: product.id, // Keep the existing ID
                name,
                description,
                price: parseFloat(price),
                category,
                imageUrl: finalImageUrls // This will be the combined array of old and new URLs
            };
            await callApi('update', { product: updatedProduct });
            setAlertMessage('Product updated successfully!');
            // After update, navigate back to the detail screen with updated product
            setCurrentScreen('ProductDetail', null, updatedProduct);
        } catch (error) {
            setAlertMessage(`Failed to update product: ${error.message}`);
        }
    };

    const closeAlert = () => {
        setAlertMessage('');
    };

    const editProductDynamicStyles = {
        fontFamily: settings.fontFamily,
        fontSize: `${settings.baseFontSizePx}px`
    };

    const currentImagePreviews = [...getFilePreviews(selectedFiles), ...imageUrlsInput.split(',').map(url => url.trim()).filter(url => url !== '')];

    return (
        <div style={{...baseStyles.container, ...editProductDynamicStyles, justifyContent: 'flex-start', overflowY: 'auto'}}>
            <CustomConfirm message={alertMessage} onConfirm={closeAlert} onCancel={closeAlert} />
            <button style={{...baseStyles.backButton, color: settings.primaryColor}} onClick={onBack}>
                ← Back to Detail
            </button>
            <h2 style={addProductStyles.title}>Edit Product</h2>

            <input style={addProductStyles.input} placeholder="Product Name" value={name} onChange={(e) => setName(e.target.value)} />
            <textarea style={{...addProductStyles.input, height: 80}} placeholder="Product Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <input style={addProductStyles.input} placeholder="Price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />

            <p style={addProductStyles.label}>Current & New Image URLs</p>
            <input
                type="file"
                multiple
                onChange={handleFileChange}
                accept="image/*"
                style={addProductStyles.fileInput}
            />
            <textarea
                style={{...addProductStyles.input, height: 80, marginTop: 10}}
                placeholder="Paste Image URLs (separate with commas)"
                value={imageUrlsInput}
                onChange={(e) => setImageUrlsInput(e.target.value)}
            />
            {currentImagePreviews.length > 0 && <p style={addProductStyles.label}>Image Previews (Local or from input):</p>}
            <div style={addProductStyles.imagePreviewContainer}>
                {currentImagePreviews.map((url, index) => (
                    <div key={index} style={addProductStyles.previewImageWrapper}>
                        <img
                            src={url}
                            alt={`Preview ${index + 1}`}
                            style={addProductStyles.previewImage}
                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/100x100/EEE/31343C?text=No+Image'; }}
                        />
                    </div>
                ))}
            </div>

            <p style={addProductStyles.label}>Category</p>
            <div style={addProductStyles.categoryPickerContainer}>
                {categories.map(cat => (
                     <button
                        key={cat}
                        style={category === cat ? {...addProductStyles.categoryPickerButton, backgroundColor: settings.primaryColor, borderColor: settings.primaryColor, color: '#fff'} : addProductStyles.categoryPickerButton}
                        onClick={() => setCategory(cat)}
                     >
                        {cat}
                     </button>
                ))}
            </div>
            <button style={{...addProductStyles.button, backgroundColor: settings.primaryColor}} onClick={handleUpdateProduct}>Update Product</button>
        </div>
    );
};


// --- App Settings Screen (New) ---
const AppSettingsScreen = ({ setCurrentScreen, callApi, showConfirm }) => {
    const { settings, updateSettingsInBackend } = useContext(SettingsContext);
    const [localSettings, setLocalSettings] = useState(settings);
    const [alertMessage, setAlertMessage] = useState('');

    useEffect(() => {
        setLocalSettings(settings); // Sync local state with context settings on mount
    }, [settings]);

    const handleSettingChange = (e) => {
        const { name, value } = e.target;
        setLocalSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleNumberSettingChange = (e) => {
        const { name, value } = e.target;
        // Ensure numbers are stored as numbers or valid strings
        setLocalSettings(prev => ({ ...prev, [name]: value === '' ? '' : parseFloat(value) }));
    };

    const handleSaveSettings = async () => {
        // Simple validation for numbers
        if (isNaN(parseFloat(localSettings.baseFontSizePx)) || parseFloat(localSettings.baseFontSizePx) <= 0) {
            setAlertMessage('Base Font Size must be a positive number.');
            return;
        }
        if (isNaN(parseInt(localSettings.categoryGridColumns)) || parseInt(localSettings.categoryGridColumns) <= 0) {
            setAlertMessage('Category Grid Columns must be a positive integer.');
            return;
        }
        const response = await updateSettingsInBackend(localSettings);
        if (response.success) {
            setAlertMessage('Settings saved successfully!');
        } else {
            setAlertMessage(`Error saving settings: ${response.message}`);
        }
    };

    const closeAlert = () => {
        setAlertMessage('');
    };

    const appSettingsDynamicStyles = {
        fontFamily: settings.fontFamily,
        fontSize: `${settings.baseFontSizePx}px`
    };

    return (
        <div style={{...baseStyles.container, ...appSettingsDynamicStyles, justifyContent: 'flex-start', overflowY: 'auto'}}>
            <CustomConfirm message={alertMessage} onConfirm={closeAlert} onCancel={closeAlert} />
            <button style={{...baseStyles.backButton, color: settings.primaryColor}} onClick={() => setCurrentScreen('Dashboard')}>
                ← Back to Dashboard
            </button>
            <h2 style={appSettingsStyles.title}>App Settings</h2>

            <div style={appSettingsStyles.settingsSection}>
                <h3 style={appSettingsStyles.settingsHeader}>Display Options</h3>
                <p style={appSettingsStyles.label}>Dashboard Background Image URL</p>
                <input
                    type="text"
                    name="backgroundUrl"
                    style={appSettingsStyles.input}
                    value={localSettings.backgroundUrl || ''}
                    onChange={handleSettingChange}
                    placeholder="URL for dashboard background"
                />
                {localSettings.backgroundUrl && <img src={localSettings.backgroundUrl} alt="Background Preview" style={appSettingsStyles.imagePreview} onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/100x100/EEE/31343C?text=No+Image'; }} />}

                <p style={appSettingsStyles.label}>Primary Color (e.g., #007BFF)</p>
                <input
                    type="color"
                    name="primaryColor"
                    style={appSettingsStyles.colorInput}
                    value={localSettings.primaryColor || '#007BFF'}
                    onChange={handleSettingChange}
                />
                <input
                    type="text"
                    name="primaryColor"
                    style={{...appSettingsStyles.input, width: 'calc(100% - 60px)', display: 'inline-block', verticalAlign: 'middle'}}
                    value={localSettings.primaryColor || '#007BFF'}
                    onChange={handleSettingChange}
                />

                <p style={appSettingsStyles.label}>Secondary Color (e.g., #28a745)</p>
                <input
                    type="color"
                    name="secondaryColor"
                    style={appSettingsStyles.colorInput}
                    value={localSettings.secondaryColor || '#28a745'}
                    onChange={handleSettingChange}
                />
                 <input
                    type="text"
                    name="secondaryColor"
                    style={{...appSettingsStyles.input, width: 'calc(100% - 60px)', display: 'inline-block', verticalAlign: 'middle'}}
                    value={localSettings.secondaryColor || '#28a745'}
                    onChange={handleSettingChange}
                />
            </div>

            <div style={appSettingsStyles.settingsSection}>
                <h3 style={appSettingsStyles.settingsHeader}>Typography</h3>
                <p style={appSettingsStyles.label}>Font Family (e.g., 'Arial', sans-serif)</p>
                <input
                    type="text"
                    name="fontFamily"
                    style={appSettingsStyles.input}
                    value={localSettings.fontFamily || ''}
                    onChange={handleSettingChange}
                    placeholder="e.g., 'Roboto', sans-serif"
                />
                <p style={appSettingsStyles.label}>Base Font Size (px)</p>
                <input
                    type="number"
                    name="baseFontSizePx"
                    style={appSettingsStyles.input}
                    value={localSettings.baseFontSizePx || 16}
                    onChange={handleNumberSettingChange}
                    min="10"
                />
            </div>

            <div style={appSettingsStyles.settingsSection}>
                <h3 style={appSettingsStyles.settingsHeader}>Layout Options</h3>
                <p style={appSettingsStyles.label}>Category Grid Columns (1-5)</p>
                <input
                    type="number"
                    name="categoryGridColumns"
                    style={appSettingsStyles.input}
                    value={localSettings.categoryGridColumns || 3}
                    onChange={handleNumberSettingChange}
                    min="1"
                    max="5"
                />
            </div>

            <button style={{...appSettingsStyles.button, backgroundColor: settings.primaryColor}} onClick={handleSaveSettings}>Save Settings</button>

            <div style={appSettingsStyles.settingsSection}>
                <h3 style={{...appSettingsStyles.settingsHeader, color: '#d9534f'}}>Danger Zone</h3>
                <p style={appSettingsStyles.label}>Manage Products (Go to Product Management)</p>
                <button style={{...appSettingsStyles.button, backgroundColor: settings.secondaryColor}} onClick={() => setCurrentScreen('SettingsProducts')}>
                    Manage Products
                </button>
            </div>
            {/* Navigating to a dedicated screen for product management from settings for better structure */}
            {currentScreen === 'SettingsProducts' && (
                <SettingsProductManagementScreen
                    setCurrentScreen={setCurrentScreen}
                    fetchProducts={fetchProducts}
                    callApi={callApi}
                    showConfirm={showConfirm}
                />
            )}
        </div>
    );
};


// --- Settings Product Management Screen (Extracted from old Settings) ---
// This is the old SettingsScreen logic, now dedicated to product management.
const SettingsProductManagementScreen = ({ setCurrentScreen, fetchProducts, callApi, showConfirm }) => {
    const { settings } = useContext(SettingsContext);
    const [products, setProducts] = useState([]);
    const [filter, setFilter] = useState('');
    const [alertMessage, setAlertMessage] = useState('');

    const loadProducts = async () => {
        try {
            const allProducts = await fetchProducts();
            setProducts(allProducts);
        } catch (error) {
            setAlertMessage(`Failed to load products for management: ${error.message}`);
        }
    };

    useEffect(() => {
        loadProducts();
    }, [fetchProducts]);

    const handleDelete = (productId) => {
        showConfirm('Are you sure you want to delete this product?', async () => {
            try {
                await callApi('delete', { id: productId });
                setAlertMessage('Product deleted successfully!');
                loadProducts(); // Reload products after deletion
            } catch (error) {
                setAlertMessage(`Failed to delete product: ${error.message}`);
            }
        });
    };

    const handleClearAll = () => {
        showConfirm('WARNING: This will delete ALL products in the catalog. This action cannot be undone. Are you sure?', async () => {
            try {
                await callApi('clearAll');
                setAlertMessage('All catalog data cleared!');
                setProducts([]); // Clear local state immediately
            } catch (error) {
                setAlertMessage(`Failed to clear all data: ${error.message}`);
            }
        });
    };

    const filteredProducts = products.filter(p => p.name && p.name.toLowerCase().includes(filter.toLowerCase()));

    const settingsProductDynamicStyles = {
        fontFamily: settings.fontFamily,
        fontSize: `${settings.baseFontSizePx}px`
    };

    return (
        <div style={{...baseStyles.container, ...settingsProductDynamicStyles, justifyContent: 'flex-start'}}>
            <CustomConfirm message={alertMessage} onConfirm={() => setAlertMessage(null)} onCancel={() => setAlertMessage(null)} />
            <button style={{...baseStyles.backButton, color: settings.primaryColor}} onClick={() => setCurrentScreen('Settings')}>
                ← Back to Settings
            </button>
            <h2 style={appSettingsStyles.title}>Manage Products</h2>

            <div style={appSettingsStyles.settingsSection}>
                <h3 style={appSettingsStyles.settingsHeader}>Product List</h3>
                <input
                    type="text"
                    placeholder="Filter products to delete..."
                    style={appSettingsStyles.input}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
                <div style={appSettingsStyles.productListContainer}>
                    {filteredProducts.length > 0 ? filteredProducts.map(p => (
                        <div key={p.id} style={appSettingsStyles.productListItem}>
                            <span>{p.name} ({p.category})</span>
                            <button onClick={() => handleDelete(p.id)} style={appSettingsStyles.deleteButton}>Delete</button>
                        </div>
                    )) : <p>No products found.</p>}
                </div>
            </div>

            <div style={appSettingsStyles.settingsSection}>
                <h3 style={{...appSettingsStyles.settingsHeader, color: '#d9534f'}}>Clear All Data</h3>
                <button onClick={handleClearAll} style={appSettingsStyles.clearAllButton}>Clear All Catalog Data</button>
            </div>
        </div>
    );
};


// --- Search Screen ---
const SearchScreen = ({ searchTerm, onProductSelect, setCurrentScreen, fetchProducts }) => {
    const { settings } = useContext(SettingsContext);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const performSearch = async () => {
            setLoading(true);
            setError(null);
            try {
                const allProducts = await fetchProducts();
                const searchResults = allProducts.filter(p =>
                    p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase())
                );
                setResults(searchResults);
            } catch (err) {
                setError(err.message || 'Failed to perform search.');
            } finally {
                setLoading(false);
            }
        };
        performSearch();
    }, [searchTerm, fetchProducts]);

    const searchDynamicStyles = {
        fontFamily: settings.fontFamily,
        fontSize: `${settings.baseFontSizePx}px`
    };

    if (loading) {
        return <div style={{...baseStyles.container, ...searchDynamicStyles, justifyContent: 'center', color: '#555'}}>Searching...</div>;
    }

    if (error) {
        return <div style={{...baseStyles.container, ...searchDynamicStyles, justifyContent: 'center', color: 'red'}}>Error: {error}</div>;
    }

    return (
         <div style={{...baseStyles.container, ...searchDynamicStyles, justifyContent:'flex-start'}}>
            <button style={{...baseStyles.backButton, color: settings.primaryColor}} onClick={() => setCurrentScreen('Dashboard')}>
                ← Back to Dashboard
            </button>
            <h2 style={searchStyles.title}>Search Results for "{searchTerm}"</h2>
             {results.length === 0 ? (
                <p style={searchStyles.noProductsText}>No products found.</p>
            ) : (
                <div style={searchStyles.productGridContainer}>
                    {results.map(product => (
                        <div key={product.id} style={searchStyles.productCard} onClick={() => onProductSelect(product)}>
                            <div style={searchStyles.productImage}>
                                <img
                                    src={product.imageUrl && product.imageUrl.length > 0 ? product.imageUrl[0] : 'https://placehold.co/150x150/EEE/31343C?text=No+Image'}
                                    alt={product.name}
                                    style={searchStyles.productImageTag}
                                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x150/EEE/31343C?text=No+Image'; }}
                                />
                            </div>
                            <div style={searchStyles.productDetails}>
                                <p style={searchStyles.productName}>{product.name}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


// --- Stylesheet ---
// Base styles that can be overridden or extended
const baseStyles = {
  safeArea: { height: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", backgroundColor: '#f4f6f8', overflow: 'hidden' },
  container: { height: '100%', padding: '20px', backgroundColor: '#f4f6f8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' },
  input: { width: '100%', maxWidth: 400, padding: 15, border: '1px solid #ddd', borderRadius: 10, marginBottom: 15, backgroundColor: '#fff', fontSize: 16, boxSizing: 'border-box' },
  button: { backgroundColor: '#007BFF', color: 'white', fontWeight: 'bold', fontSize: 16, padding: 15, borderRadius: 10, width: '100%', maxWidth: 400, marginTop: 10, border: 'none', cursor: 'pointer', transition: 'background-color 0.3s ease, transform 0.2s ease' },
  backButton: { position: 'absolute', top: 20, left: 20, zIndex: 1, background: '#fff', border: 'none', color: '#333', fontSize: 24, cursor: 'pointer', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'transform 0.2s ease, background-color 0.3s ease' },
};

// Login Screen Styles
const loginStyles = {
    container: { ...baseStyles.container, backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url(https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1)', backgroundSize: 'cover', backgroundPosition: 'center' },
    title: { fontSize: 36, fontWeight: 'bold', marginBottom: 30, color: '#fff', textAlign: 'center', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' },
    errorText: { color: '#ffdddd', backgroundColor: 'rgba(255, 0, 0, 0.3)', padding: '10px', borderRadius: '5px', marginBottom: 10, textAlign: 'center' },
    input: { ...baseStyles.input, backgroundColor: 'rgba(255,255,255,0.9)', border: 'none', '&:focus': { outline: '2px solid #007BFF' } },
    button: { ...baseStyles.button, backgroundColor: '#007BFF' },
};

// Dashboard Screen Styles
const dashboardStyles = {
    container: { ...baseStyles.container, height: '100%', flexDirection: 'column', boxSizing: 'border-box', backgroundSize: 'cover', backgroundPosition: 'center', },
    header: { padding: '20px',  display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff', width: '100%', position: 'relative' },
    headerTitle: { fontSize: 28, fontWeight: '600', margin: 0, textAlign: 'center', flexGrow: 1, textShadow: '1px 1px 3px rgba(0,0,0,0.3)' },
    settingsButton: { background: 'none', border: 'none', fontSize: 32, cursor: 'pointer', color: '#fff', position: 'absolute', left: 20, top: 20, transition: 'transform 0.2s ease', '&:hover': {transform: 'rotate(45deg)'}},
    searchContainer: { padding: '0 20px 20px 20px', display: 'flex', gap: '10px', width: '100%', maxWidth: '600px' },
    searchInput: { flexGrow: 1, padding: '12px 15px', fontSize: 16, border: 'none', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.9)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    searchButton: { padding: '12px 20px', fontSize: 16, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', transition: 'background-color 0.3s ease' },
    mainContent: { flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' },
    subHeaderTitle: { fontSize: 22, color: '#f0f0f0', marginBottom: 20, fontWeight: '500', textAlign: 'center', textShadow: '1px 1px 2px rgba(0,0,0,0.3)' },
    categoryGrid: { display: 'grid', gap: '15px', width: '100%', maxWidth: '800px', margin: '0 auto', paddingBottom: '20px' },
    categoryButton: { width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '20px 10px', borderRadius: 15, textAlign: 'center', border: '1px solid', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80px', fontSize: 18, fontWeight: 'bold', transition: 'background-color 0.2s, transform 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
        '&:hover': { transform: 'translateY(-3px)' }
    },
    addProductButton: { ...baseStyles.button, width: 'auto', padding: '15px 30px', margin: '30px auto', display: 'block', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' },
};

// Product List Screen Styles
const productListStyles = {
    productListHeader: { width: '100%', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '20px' },
    title: { fontSize: 28, fontWeight: '600', margin: 0, textAlign: 'center', color: '#333', flexGrow: 1, textShadow: '1px 1px 2px rgba(0,0,0,0.1)' },
    addProductInCategoryButton: { ...baseStyles.button, width: 'auto', padding: '10px 18px', borderRadius: '25px', fontSize: '14px', margin: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    productGridContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px', width: '100%', maxWidth: '1200px', padding: '20px 0', overflowY: 'auto' },
    productCard: { backgroundColor: '#fff', borderRadius: 15, boxShadow: '0 4px 10px rgba(0,0,0,0.1)', overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s ease, box-shadow 0.2s ease', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 6px 15px rgba(0,0,0,0.15)' } },
    productImage: { width: '100%', paddingTop: '100%', position: 'relative', backgroundColor: '#f0f0f0' },
    productImageTag: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '15px 15px 0 0' },
    productDetails: { padding: '15px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexGrow: 1 },
    productName: { fontSize: 18, fontWeight: '600', margin: '0 0 5px 0', color: '#333'},
    noProductsText: { textAlign: 'center', marginTop: 50, fontSize: 18, color: '#666' },
};

// Product Detail Screen Styles
const productDetailStyles = {
    contentWrapper: { width:'100%', marginTop: 50, textAlign: 'center', maxWidth: '800px', margin: '50px auto' },
    imageGallery: { display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px', margin: '0 auto' },
    detailImage: { width: '100%', height: 'auto', aspectRatio: '16/9', objectFit: 'contain', borderRadius: 15, boxShadow: '0 4px 8px rgba(0,0,0,0.1)', backgroundColor: '#eee', },
    detailName: { fontSize: 36, fontWeight: 'bold', marginTop: 25, marginBottom: 10, color: '#333' },
    detailPrice: { fontSize: 28, fontWeight: 'bold', marginTop: 10, marginBottom: 20, },
    detailDescription: { fontSize: 18, color: '#555', marginTop: 20, lineHeight: 1.8, textAlign: 'justify', maxWidth: '700px', margin: '20px auto', padding: '0 10px' },
    editButton: { ...baseStyles.button, position: 'absolute', top: 20, right: 20, width: 'auto', padding: '10px 20px', borderRadius: '25px', fontSize: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }
};

// Add/Edit Product Screen Styles
const addProductStyles = {
    title: { fontSize: 28, fontWeight: '600', marginBottom: 20, textAlign: 'center', color: '#333', width: '100%' },
    input: { ...baseStyles.input, border: '1px solid #ccddee', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)' },
    label: { fontSize: 16, marginBottom: 8, fontWeight: '600', color: '#444', textAlign: 'left', width: '100%', maxWidth: 400, marginTop: 10 },
    categoryPickerContainer: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '15px', width: '100%', maxWidth: 400, justifyContent: 'center' },
    categoryPickerButton: { padding: '10px 15px', borderRadius: 20, border: '1px solid #ddd', background: '#f0f0f0', cursor: 'pointer', color: '#333', fontSize: 14, transition: 'background-color 0.2s, border-color 0.2s, color 0.2s' },
    fileInput: { width: '100%', maxWidth: 400, padding: 10, marginBottom: 15, border: '1px solid #ddd', borderRadius: 10, backgroundColor: '#fff', fontSize: 16, boxSizing: 'border-box' },
    imagePreviewContainer: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: 10, marginBottom: 20, justifyContent: 'center', width: '100%', maxWidth: 400 },
    previewImageWrapper: { border: '1px solid #eee', borderRadius: 8, overflow: 'hidden', width: 100, height: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9f9f9' },
    previewImage: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
    button: { ...baseStyles.button, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }
};


// App Settings Screen Styles (New)
const appSettingsStyles = {
    title: { ...addProductStyles.title, color: '#333' },
    settingsSection: { width: '100%', maxWidth: '800px', margin: '20px auto', padding: '25px', background: '#fff', borderRadius: '12px', boxShadow: '0 5px 15px rgba(0,0,0,0.08)' },
    settingsHeader: { marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '25px', fontSize: 22, fontWeight: '600', color: '#555' },
    label: { ...addProductStyles.label, maxWidth: 'none', textAlign: 'left', marginBottom: 5, color: '#555', fontSize: 15 },
    input: { ...addProductStyles.input, maxWidth: 'none', marginBottom: 15, border: '1px solid #ccc' },
    colorInput: { width: '50px', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer', verticalAlign: 'middle', marginRight: '10px' },
    imagePreview: { width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', marginTop: '10px', marginBottom: '15px', border: '1px solid #eee', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    button: { ...baseStyles.button, maxWidth: '300px', margin: '20px auto', display: 'block', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' },
    productListContainer: { width: '100%', maxHeight: '400px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '8px', padding: '10px', background: '#f9f9f9', marginBottom: '20px' },
    productListItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid #eee', fontSize: 16, color: '#444', backgroundColor: '#fff', borderRadius: '6px', marginBottom: '5px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    deleteButton: { backgroundColor: '#d9534f', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontSize: '14px', transition: 'background-color 0.2s ease' },
    clearAllButton: { ...baseStyles.button, backgroundColor: '#d9534f', maxWidth: '300px', margin: '20px auto', display: 'block', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }
};

// Modal Styles
const modalStyles = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    content: { background: 'white', padding: '30px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 8px 25px rgba(0,0,0,0.25)', maxWidth: '400px', width: '90%' },
    text: { fontSize: '18px', marginBottom: '25px', color: '#333' },
    buttonContainer: { display: 'flex', justifyContent: 'center', gap: '20px' },
    confirmButton: { backgroundColor: '#007BFF', color: 'white', border: 'none', padding: '12px 28px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', transition: 'background-color 0.2s ease' },
    cancelButton: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '12px 28px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', transition: 'background-color 0.2s ease' }
};

// Search Screen Styles (Inherits much from ProductList but kept separate for clarity)
const searchStyles = {
    title: productListStyles.title,
    noProductsText: productListStyles.noProductsText,
    productGridContainer: productListStyles.productGridContainer,
    productCard: productListStyles.productCard,
    productImage: productListStyles.productImage,
    productImageTag: productListStyles.productImageTag,
    productDetails: productListStyles.productDetails,
    productName: productListStyles.productName,
};


// Add Google Font - Ensure this runs once
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'; // Changed to Inter as per common practice
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);
