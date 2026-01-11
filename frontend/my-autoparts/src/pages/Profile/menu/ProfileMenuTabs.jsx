export default function ProfileMenuTabs({ tabs, activeTab, onTabChange }) {
    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 sticky top-4">
            <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">Меню</h2>
            </div>
            <div className="flex flex-col">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`px-4 py-3 text-left text-sm font-medium border-l-4 transition-colors ${
                            activeTab === tab.id
                                ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
