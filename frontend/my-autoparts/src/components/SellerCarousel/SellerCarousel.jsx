import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPublicSellers } from '../../redux/slices/SellerSlice';
import { normalizeImageUrl } from '../../utils/apiClient';

const SellerCarousel = () => {
  const [showDemoSellers, setShowDemoSellers] = useState(false);
  const dispatch = useDispatch();
  const { sellers, loading, error } = useSelector((state) => state.sellers);

  // Function to generate random color
  const getRandomColor = () => {
    const colors = [
      'bg-red-400',
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-orange-500',
      'bg-teal-500',
      'bg-cyan-500',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Function to get initials from organization name
  const getInitials = (name) => {
    if (!name) return '?';
    const words = name.split(' ').filter(word => word.trim() !== '');
    if (words.length === 0) return '?';
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    } else {
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    }
  };

  useEffect(() => {
    const getSellers = async () => {
      try {
        await dispatch(fetchPublicSellers()).unwrap();
      } catch (error) {
        // Silently handle errors (like unauthorized access)
        console.log('Could not fetch public sellers:', error);
        // Set a flag to show demo sellers if API access is denied
        setShowDemoSellers(true);
      }
    };
    getSellers();
  }, [dispatch]);

  if (loading && !showDemoSellers) {
    return (
      <div className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Наши продавцы</h2>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Use demo sellers if API access is denied or no sellers exist
  const sellersWithOrgs = showDemoSellers 
    ? [
        { id: 'demo1', organization_name: 'АвтоМастер', organization_id: '1' },
        { id: 'demo2', organization_name: 'ЗапчастьПлюс', organization_id: '2' },
        { id: 'demo3', organization_name: 'МоторПро', organization_id: '3' },
        { id: 'demo4', organization_name: 'Шины и Диски', organization_id: '4' },
        { id: 'demo5', organization_name: 'Кузовной Ремонт', organization_id: '5' },
        { id: 'demo6', organization_name: 'АвтоСервис', organization_id: '6' },
        { id: 'demo7', organization_name: 'Механик', organization_id: '7' },
      ]
    : (sellers && Array.isArray(sellers) ? sellers.filter(seller => seller.organization_name) : []);

  if (sellersWithOrgs.length === 0) {
    return null; // Don't render if no sellers
  }

  return (
    <div className="py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Наши продавцы</h2>
          <p className="text-gray-600">Лучшие поставщики автозапчастей</p>
        </div>
        
        <div className="relative overflow-hidden py-6">
          <div className="flex animate-marquee whitespace-nowrap">
            <div className="flex items-center">
              {sellersWithOrgs.map((seller, index) => (
                <div key={`${seller.id}-first-${index}`} className="mx-3 flex flex-col items-center">
                  <div className="w-20 h-20 rounded-xl overflow-hidden shadow-md bg-white flex items-center justify-center p-2 mb-2 border border-gray-200">
                    {seller.logo_organization ? (
                      <img
                        src={normalizeImageUrl(seller.logo_organization)}
                        alt={seller.organization_name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.style.display = 'none';
                          const parent = e.target.parentElement;
                          const placeholderDiv = document.createElement('div');
                          placeholderDiv.className = `w-full h-full flex items-center justify-center ${getRandomColor()} text-white font-bold text-lg`;
                          placeholderDiv.textContent = getInitials(seller.organization_name);
                          parent.appendChild(placeholderDiv);
                        }}
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${getRandomColor()} text-white font-bold text-lg`}>
                        {getInitials(seller.organization_name)}
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-gray-900 text-center max-w-[80px] truncate" title={seller.organization_name}>
                    {seller.organization_name}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center">
              {sellersWithOrgs.map((seller, index) => (
                <div key={`${seller.id}-second-${index}`} className="mx-3 flex flex-col items-center">
                  <div className="w-20 h-20 rounded-xl overflow-hidden shadow-md bg-white flex items-center justify-center p-2 mb-2 border border-gray-200">
                    {seller.logo_organization ? (
                      <img
                        src={normalizeImageUrl(seller.logo_organization)}
                        alt={seller.organization_name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.style.display = 'none';
                          const parent = e.target.parentElement;
                          const placeholderDiv = document.createElement('div');
                          placeholderDiv.className = `w-full h-full flex items-center justify-center ${getRandomColor()} text-white font-bold text-lg`;
                          placeholderDiv.textContent = getInitials(seller.organization_name);
                          parent.appendChild(placeholderDiv);
                        }}
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${getRandomColor()} text-white font-bold text-lg`}>
                        {getInitials(seller.organization_name)}
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-gray-900 text-center max-w-[80px] truncate" title={seller.organization_name}>
                    {seller.organization_name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 20s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default SellerCarousel;