// Welcome to your Digital Catalog App!
// This version uses Google Sheets as its online storage via Google Apps Script.
// All data is now saved to your Google Sheet, making it accessible online.
// This version supports adding multiple images per product.

import React, { useState, useEffect } from 'react';

// --- IMPORTANT: Replace with your deployed Google Apps Script Web App URL ---
// After deploying your Google Apps Script (from Part 2), copy its "Web app URL" and paste it here.
const GOOGLE_SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbyDj5ZveFJlT1AIxB-46g4wyQgEGunAei0T8LXE-Y-wLoqQ8LUcFAdHRJexGL94F-d3/exec'; // <--- This URL has been updated!

// --- Main App Component ---
// This is the root of your application.
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
        method: 'POST', // Use POST for all write operations (add, delete, clear)
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

  // Function to fetch all products from Google Sheet
  const fetchProducts = async () => {
    try {
      // For GET requests, the Apps Script `doGet` function doesn't expect a POST body.
      // We directly call the URL and the doGet function is triggered.
      const response = await fetch(GOOGLE_SHEETS_API_URL);
      const products = await response.json();
      if (!response.ok || products.error) {
         throw new Error(products.error || 'Failed to fetch products');
      }
      return products;
    } catch (error) {
      console.error('Error fetching products:', error);
      // Return an empty array or handle error gracefully in UI
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
      setConfirmAction(() => action); // Store the function to be called on confirmation
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
    if (selectedProduct) {
        return <ProductDetailScreen product={selectedProduct} onBack={() => setSelectedProduct(null)} />;
    }

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
                      callApi={callApi} // Pass API function
                    />;
        case 'Settings':
            return <SettingsScreen
                      setCurrentScreen={navigateTo}
                      fetchProducts={fetchProducts} // Pass fetch function
                      callApi={callApi}           // Pass API function
                      showConfirm={showConfirm}    // Pass custom confirm
                    />;
        case 'Search':
            return <SearchScreen
                      searchTerm={searchTerm}
                      onProductSelect={setSelectedProduct}
                      setCurrentScreen={navigateTo}
                      fetchProducts={fetchProducts} // Pass fetch function
                    />;
        default:
            if (currentScreen.startsWith('ProductList-')) {
                const category = currentScreen.split('-')[1];
                return <ProductListScreen
                          category={category}
                          setCurrentScreen={navigateTo}
                          onProductSelect={setSelectedProduct}
                          fetchProducts={fetchProducts} // Pass fetch function
                       />;
            }
            return <DashboardScreen setCurrentScreen={navigateTo} setSearchTerm={setSearchTerm}/>;
    }
  };

  return (
    <div style={styles.safeArea}>
      {renderContent()}
      <CustomConfirm
        message={confirmMessage}
        onConfirm={handleConfirm}
        onCancel={handleCancelConfirm}
      />
    </div>
  );
}

// --- Login Screen ---
const LoginScreen = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = () => {
        // This is a static login for the app. Data access is handled by Apps Script permissions.
        if (username === 'Admin' && password === 'MarketingComfort25') {
            onLoginSuccess();
        } else {
            setError('Invalid username or password');
        }
    };

    return (
        <div style={styles.loginContainer}>
            <p style={{...styles.title, color: '#fff', fontSize: 32}}>Comfort Digital Catalogue</p>
            {error && <p style={styles.errorText}>{error}</p>}
            <input
                style={{...styles.input, backgroundColor: 'rgba(255,255,255,0.9)'}}
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
            />
            <input
                style={{...styles.input, backgroundColor: 'rgba(255,255,255,0.9)'}}
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <button style={styles.button} onClick={handleLogin}>
                Enter
            </button>
        </div>
    );
};


// --- Reusable Custom Alert Modal (renamed to CustomConfirm for clarity) ---
const CustomConfirm = ({ message, onConfirm, onCancel }) => {
    if (!message) return null;
    return (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
                <p style={styles.modalText}>{message}</p>
                <div style={styles.modalButtonContainer}>
                    <button style={styles.modalButton} onClick={onConfirm}>Yes</button>
                    <button style={{...styles.modalButton, backgroundColor: '#6c757d'}} onClick={onCancel}>Cancel</button>
                </div>
            </div>
        </div>
    );
};


// --- Dashboard Screen ---
const DashboardScreen = ({ setCurrentScreen, setSearchTerm }) => {
    const categories = ['Bedding', 'Towels', 'Bathroom Amenities', 'Guest Supplies', 'Housekeeping', 'Lobby', 'Leather Accessories', 'Safety Boxes', 'Restaurant Supplies', 'Hospital Supplies', 'Spa Supplies', 'Eco-Friendly', 'S-Collection'];
    const [localSearch, setLocalSearch] = useState('');

    const handleSearch = () => {
      if(localSearch.trim()){
        setSearchTerm(localSearch.trim());
        setCurrentScreen('Search');
      }
    }

    return (
        <div style={styles.dashboardContainer}>
            <div style={styles.header}>
              <h1 style={styles.headerTitle}>Comfort Digital Catalogue</h1>
              <button onClick={() => setCurrentScreen('Settings')} style={styles.settingsButton}>⚙️</button>
            </div>

            <div style={styles.searchContainer}>
                <input
                  type="text"
                  placeholder="Search for a product..."
                  style={styles.searchInput}
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button style={styles.searchButton} onClick={handleSearch}>Search</button>
            </div>

            <div style={styles.mainContent}>
              <p style={styles.subHeaderTitle}>Browse Categories</p>
              <div style={styles.categoryGrid}>
                  {categories.map(category => (
                      <button key={category} style={styles.categoryButton} onClick={() => setCurrentScreen(`ProductList-${category}`)}>
                          {category}
                      </button>
                  ))}
              </div>
              <button style={{...styles.button, ...styles.addProductButton}} onClick={() => setCurrentScreen('AddProduct', null)}>
                  + Add New Product
              </button>
            </div>
        </div>
    );
};

// --- Product List Screen ---
const ProductListScreen = ({ category, setCurrentScreen, onProductSelect, fetchProducts }) => {
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

    if (loading) {
        return <div style={{...styles.container, justifyContent: 'center', color: '#555'}}>Loading products...</div>;
    }

    if (error) {
        return <div style={{...styles.container, justifyContent: 'center', color: 'red'}}>Error: {error}</div>;
    }

    return (
        <div style={{...styles.container, justifyContent:'flex-start'}}>
            <button style={styles.backButton} onClick={() => setCurrentScreen('Dashboard')}>
                ← Back to Dashboard
            </button>
            <div style={styles.productListHeader}>
                <h2 style={styles.title}>{category}</h2>
                <button style={styles.addProductInCategoryButton} onClick={() => setCurrentScreen('AddProduct', category)}>+ Add Product</button>
            </div>
            {products.length === 0 ? (
                <p style={styles.noProductsText}>No products found in this category.</p>
            ) : (
                <div style={styles.productGridContainer}>
                    {products.map(product => (
                        <div key={product.id} style={styles.productCard} onClick={() => onProductSelect(product)}>
                            {/* Display the first image as thumbnail */}
                            <div style={styles.productImage}>
                                <img
                                    src={product.imageUrl && product.imageUrl.length > 0 ? product.imageUrl[0] : 'https://placehold.co/150x150/EEE/31343C?text=No+Image'}
                                    alt={product.name}
                                    style={styles.productImageTag}
                                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x150/EEE/31343C?text=No+Image'; }}
                                />
                            </div>
                            <div style={styles.productDetails}>
                                <p style={styles.productName}>{product.name}</p>
                                <p style={styles.productPrice}>${parseFloat(product.price).toFixed(2)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Product Detail Screen ---
const ProductDetailScreen = ({ product, onBack }) => {
    // Ensure product.imageUrl is an array for mapping
    const imagesToDisplay = Array.isArray(product.imageUrl) ? product.imageUrl : [];

    return (
        <div style={{...styles.container, justifyContent: 'flex-start'}}>
             <button style={styles.backButton} onClick={onBack}>
                ← Back to List
            </button>
            <div style={{width:'100%', marginTop: 50, textAlign: 'center'}}>
                {imagesToDisplay.length > 0 ? (
                    <div style={styles.imageGallery}>
                        {imagesToDisplay.map((imgSrc, index) => (
                            <img
                                key={index}
                                src={imgSrc}
                                alt={`${product.name} image ${index + 1}`}
                                style={styles.detailImage}
                                onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/1400x1400/EEE/31343C?text=No+Image'; }}
                            />
                        ))}
                    </div>
                ) : (
                    <img src={'https://placehold.co/1400x1400/EEE/31343C?text=No+Image'} alt="No Image" style={styles.detailImage} />
                )}
                <h2 style={styles.detailName}>{product.name}</h2>
                <p style={styles.detailPrice}>${parseFloat(product.price).toFixed(2)}</p>
                <p style={styles.detailDescription}>{product.description}</p>
            </div>
        </div>
    );
};

// --- Add Product Screen ---
const AddProductScreen = ({ setCurrentScreen, initialCategory, callApi }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState(initialCategory || 'Bedding');
    // Changed imageUrl to imageUrls (array of strings)
    const [imageUrlsInput, setImageUrlsInput] = useState(''); // Textarea input for comma-separated URLs
    const [alertMessage, setAlertMessage] = useState('');

    const categories = ['Bedding', 'Towels', 'Bathroom Amenities', 'Guest Supplies', 'Housekeeping', 'Lobby', 'Leather Accessories', 'Safety Boxes', 'Restaurant Supplies', 'Hospital Supplies', 'Spa Supplies', 'Eco-Friendly', 'S-Collection'];

    const handleSaveProduct = async () => {
        if (!name || !price || !category) {
            setAlertMessage('Please fill in Product Name, Price, and Category.');
            return;
        }

        // Convert the comma-separated input string into an array of trimmed URLs
        const urlsArray = imageUrlsInput.split(',').map(url => url.trim()).filter(url => url !== '');

        try {
            const newProduct = { name, description, price: parseFloat(price), category, imageUrl: urlsArray }; // Pass imageUrls as an array
            await callApi('add', { product: newProduct });
            setAlertMessage('Product added successfully!');
        } catch (error) {
            setAlertMessage(`Failed to add product: ${error.message}`);
        }
    };

    const closeAlert = () => {
        if(alertMessage === 'Product added successfully!'){
            setCurrentScreen('Dashboard');
        }
        setAlertMessage('');
    }

    return (
        <div style={{...styles.container, justifyContent: 'flex-start', overflowY: 'auto'}}>
            <CustomConfirm message={alertMessage} onConfirm={closeAlert} onCancel={closeAlert} /> {/* Reusing CustomConfirm for simple alerts */}
            <button style={styles.backButton} onClick={() => setCurrentScreen('Dashboard')}>
                ← Back to Dashboard
            </button>
            <h2 style={styles.title}>Add a New Product</h2>

            <input style={styles.input} placeholder="Product Name" value={name} onChange={(e) => setName(e.target.value)} />
            <textarea style={{...styles.input, height: 80}} placeholder="Product Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <input style={styles.input} placeholder="Price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            {/* Changed from input to textarea for multiple URLs */}
            <textarea
                style={{...styles.input, height: 80}}
                placeholder="Image URLs (separate with commas)"
                value={imageUrlsInput}
                onChange={(e) => setImageUrlsInput(e.target.value)}
            />

            <p style={styles.label}>Category</p>
            <div style={styles.categoryPickerContainer}>
                {categories.map(cat => (
                     <button
                        key={cat}
                        style={category === cat ? {...styles.categoryPickerButton, ...styles.categoryPickerButtonSelected} : styles.categoryPickerButton}
                        onClick={() => setCategory(cat)}
                     >
                        {cat}
                     </button>
                ))}
            </div>

            {/* Display previews for all entered image URLs */}
            {imageUrlsInput.split(',').map(url => url.trim()).filter(url => url !== '').map((url, index) => (
                <img
                    key={index}
                    src={url}
                    alt={`Preview ${index + 1}`}
                    style={styles.previewImage}
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/500x500/EEE/31343C?text=No+Image'; }}
                />
            ))}
            <button style={styles.button} onClick={handleSaveProduct}>Save Product</button>
        </div>
    );
};

// --- Settings Screen ---
const SettingsScreen = ({ setCurrentScreen, fetchProducts, callApi, showConfirm }) => {
    const [products, setProducts] = useState([]);
    const [filter, setFilter] = useState('');
    const [alertMessage, setAlertMessage] = useState(''); // For any error messages

    const loadProducts = async () => {
        try {
            const allProducts = await fetchProducts();
            setProducts(allProducts);
        } catch (error) {
            setAlertMessage(`Failed to load products for settings: ${error.message}`);
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

    return (
        <div style={{...styles.container, justifyContent: 'flex-start'}}>
            <CustomConfirm message={alertMessage} onConfirm={() => setAlertMessage(null)} onCancel={() => setAlertMessage(null)} />
            <button style={styles.backButton} onClick={() => setCurrentScreen('Dashboard')}>
                ← Back to Dashboard
            </button>
            <h2 style={styles.title}>Settings</h2>

            <div style={styles.settingsSection}>
                <h3 style={styles.settingsHeader}>Manage Products</h3>
                <input
                    type="text"
                    placeholder="Filter products to delete..."
                    style={styles.input}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
                <div style={styles.productListContainer}>
                    {filteredProducts.length > 0 ? filteredProducts.map(p => (
                        <div key={p.id} style={styles.productListItem}>
                            <span>{p.name} ({p.category})</span>
                            <button onClick={() => handleDelete(p.id)} style={styles.deleteButton}>Delete</button>
                        </div>
                    )) : <p>No products found.</p>}
                </div>
            </div>

            <div style={styles.settingsSection}>
                <h3 style={{...styles.settingsHeader, color: '#d9534f'}}>Danger Zone</h3>
                <button onClick={handleClearAll} style={styles.clearAllButton}>Clear All Catalog Data</button>
            </div>
        </div>
    );
};

// --- Search Screen ---
const SearchScreen = ({ searchTerm, onProductSelect, setCurrentScreen, fetchProducts }) => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const performSearch = async () => {
            setLoading(true);
            setError(null);
            try {
                const allProducts = await fetchProducts();
                // Perform search filtering locally as Google Apps Script is not a full database for complex queries
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

    if (loading) {
        return <div style={{...styles.container, justifyContent: 'center', color: '#555'}}>Searching...</div>;
    }

    if (error) {
        return <div style={{...styles.container, justifyContent: 'center', color: 'red'}}>Error: {error}</div>;
    }

    return (
         <div style={{...styles.container, justifyContent:'flex-start'}}>
            <button style={styles.backButton} onClick={() => setCurrentScreen('Dashboard')}>
                ← Back to Dashboard
            </button>
            <h2 style={styles.title}>Search Results for "{searchTerm}"</h2>
             {results.length === 0 ? (
                <p style={styles.noProductsText}>No products found.</p>
            ) : (
                <div style={styles.productGridContainer}>
                    {results.map(product => (
                        <div key={product.id} style={styles.productCard} onClick={() => onProductSelect(product)}>
                            <div style={styles.productImage}>
                                <img
                                    src={product.imageUrl && product.imageUrl.length > 0 ? product.imageUrl[0] : 'https://placehold.co/150x150/EEE/31343C?text=No+Image'}
                                    alt={product.name}
                                    style={styles.productImageTag}
                                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x150/EEE/31343C?text=No+Image'; }}
                                />
                            </div>
                            <div style={styles.productDetails}>
                                <p style={styles.productName}>{product.name}</p>
                                <p style={styles.productPrice}>${parseFloat(product.price).toFixed(2)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


// --- Stylesheet ---
const styles = {
  safeArea: { height: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", backgroundColor: '#f4f6f8', overflow: 'hidden' },
  container: { height: '100%', padding: '20px', backgroundColor: '#f4f6f8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' },
  loginContainer: { height: '100%', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url(https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1)', backgroundSize: 'cover', backgroundPosition: 'center' },
  dashboardContainer: { height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(https://images.pexels.com/photos/262048/pexels-photo-262048.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1)', backgroundSize: 'cover', backgroundPosition: 'center',},
  header: { padding: '20px',  display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' },
  headerTitle: { fontSize: 24, fontWeight: '600', margin: 0 },
  settingsButton: { background: 'none', border: 'none', fontSize: 28, cursor: 'pointer', color: '#fff'},
  searchContainer: { padding: '0 20px 20px 20px', display: 'flex', gap: '10px' },
  searchInput: { flexGrow: 1, padding: '12px 15px', fontSize: 16, border: '1px solid #ddd', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.9)' },
  searchButton: { padding: '12px 20px', fontSize: 16, backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  mainContent: { flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  subHeaderTitle: { fontSize: 20, color: '#f0f0f0', marginBottom: 20, fontWeight: '500', textAlign: 'center' },
  title: { fontSize: 28, fontWeight: '600', marginBottom: 20, textAlign: 'center', color: '#333', width: '100%' },
  input: { width: '100%', maxWidth: 400, padding: 15, border: '1px solid #ddd', borderRadius: 10, marginBottom: 15, backgroundColor: '#fff', fontSize: 16, boxSizing: 'border-box' },
  button: { backgroundColor: '#007BFF', color: 'white', fontWeight: 'bold', fontSize: 16, padding: 15, borderRadius: 10, width: '100%', maxWidth: 400, marginTop: 10, border: 'none', cursor: 'pointer' },
  addProductButton: { marginTop: 30, backgroundColor: '#28a745', width: 'auto', padding: '15px 30px', margin: '30px auto', display: 'block' },
  errorText: { color: '#ffdddd', backgroundColor: 'rgba(255, 0, 0, 0.3)', padding: '10px', borderRadius: '5px', marginBottom: 10, textAlign: 'center' },
  backButton: { position: 'absolute', top: 20, left: 20, zIndex: 1, background: '#fff', border: '1px solid #ddd', color: '#333', fontSize: 16, cursor: 'pointer', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  productListHeader: { width: '100%', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '20px' },
  addProductInCategoryButton: { backgroundColor: '#007BFF', color: 'white', fontWeight: 'bold', padding: '10px 15px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '14px' },
  categoryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' },
  categoryButton: { width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.2)', padding: '20px 10px', borderRadius: 10, textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80px', color: '#fff', fontSize: 16, fontWeight: 'bold', transition: 'background-color 0.2s' },
  productGridContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '20px', width: '100%', padding: '20px 0' },
  productCard: { backgroundColor: '#fff', borderRadius: 10, boxShadow: '0 2px 5px rgba(0,0,0,0.1)', overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column' },
  productImage: { width: '100%', paddingTop: '100%', position: 'relative', backgroundColor: '#f0f0f0' },
  productImageTag: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' },
  productDetails: { padding: '10px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexGrow: 1 },
  productName: { fontSize: 16, fontWeight: '600', margin: '0 0 5px 0', color: '#333'},
  productPrice: { fontSize: 14, fontWeight: 'bold', color: '#28a745', margin: 0 },
  noProductsText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#666' },
  label: { fontSize: 16, marginBottom: 10, fontWeight: '600', color: '#444', textAlign: 'left', width: '100%' },
  categoryPickerContainer: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '15px', width: '100%' },
  categoryPickerButton: { padding: '10px 15px', borderRadius: 20, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', color: '#333', fontSize: 14 },
  categoryPickerButtonSelected: { backgroundColor: '#007BFF', borderColor: '#007BFF', color: '#fff', fontWeight: 'bold' },
  previewImage: { width: '100%', maxWidth: 500, height: 'auto', aspectRatio: 1, borderRadius: 10, marginTop: 20, marginBottom: 10, objectFit: 'cover', backgroundColor: '#eee', margin: '0 auto' },
  imageGallery: { display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px', margin: '0 auto' }, // New style for image gallery
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { background: 'white', padding: '20px 40px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 4px 8px rgba(0,0,0,0.2)' },
  modalText: { fontSize: '18px', marginBottom: '20px' },
  modalButtonContainer: { display: 'flex', justifyContent: 'center', gap: '15px' }, // New style for button container
  modalButton: { backgroundColor: '#007BFF', color: 'white', border: 'none', padding: '10px 25px', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' },
  detailImage: { width: '100%', maxWidth: 500, height: 'auto', aspectRatio: 1, objectFit: 'cover', borderRadius: 10, margin: '20px auto' },
  detailName: { fontSize: 32, fontWeight: 'bold', marginTop: 15, margin: 0, textAlign: 'center' },
  detailPrice: { fontSize: 24, color: '#28a745', fontWeight: 'bold', marginTop: 10, margin: 0, textAlign: 'center' },
  detailDescription: { fontSize: 16, color: '#555', marginTop: 20, lineHeight: 1.6, textAlign: 'center', maxWidth: '600px', margin: '20px auto' },
  settingsSection: { width: '100%', maxWidth: '800px', margin: '20px auto', padding: '20px', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  settingsHeader: { marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px' },
  productListContainer: { width: '100%', maxHeight: 'calc(100vh - 250px)', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '8px', padding: '10px' },
  productListItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee' },
  deleteButton: { backgroundColor: '#d9534f', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' },
  clearAllButton: { width: '100%', backgroundColor: '#d9534f', color: 'white', border: 'none', padding: '15px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }
};

// Add Google Font
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Segoe+UI:wght@400;500;600;700&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);