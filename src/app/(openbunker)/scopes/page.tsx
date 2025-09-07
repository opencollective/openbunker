'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';

interface Scope {
  id: string;
  slug: string;
  name: string;
  description: string;
  owner: string;
  keyNpub: string;
  createdAt: string;
  updatedAt: string;
  key: {
    npub: string;
    nsec: string;
    name: string;
  };
}

export default function ScopesPage() {
  const { user } = useAuth();
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    slug: '',
  });

  useEffect(() => {
    if (user) {
      fetchScopes();
    }
  }, [user]);

  const fetchScopes = async () => {
    try {
      const response = await fetch('/api/scopes');
      if (response.ok) {
        const data = await response.json();
        setScopes(data.scopes || []);
      }
    } catch (error) {
      console.error('Error fetching scopes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateScope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setCreating(true);
    try {
      const response = await fetch('/api/scopes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setScopes([data.scope, ...scopes]);
        setFormData({ name: '', description: '', slug: '' });
        alert('Scope created successfully!');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating scope:', error);
      alert('Error creating scope');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
        <div className="p-6">
          <p className="text-gray-900">Loading scopes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">Scopes</h1>

        {/* Create Scope Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">
            Create New Scope
          </h2>
          <form onSubmit={handleCreateScope} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={e =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                rows={3}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slug
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={e =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="my-community-scope"
                required
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Scope'}
            </button>
          </form>
        </div>

        {/* Scopes List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Your Scopes</h2>
          {scopes.length === 0 ? (
            <p className="text-gray-500">No scopes created yet.</p>
          ) : (
            scopes.map(scope => (
              <div key={scope.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{scope.name}</h3>
                    <p className="text-gray-600 text-sm">/{scope.slug}</p>
                    <p className="text-gray-700 mt-2">{scope.description}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(scope.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-2">
                    Generated Key
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-600">
                        Public Key (npub):
                      </span>
                      <div className="font-mono text-sm bg-gray-100 p-2 rounded mt-1 break-all">
                        {scope.key.npub}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">
                        Private Key (nsec):
                      </span>
                      <div className="font-mono text-sm bg-gray-100 p-2 rounded mt-1 break-all">
                        {scope.key.nsec}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
