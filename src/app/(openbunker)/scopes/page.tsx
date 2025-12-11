'use client';

import { useAuth } from '@/contexts/AuthContext';
import { nip19 } from 'nostr-tools';
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
  allowedApplications?: string[] | null;
  key?: {
    npub: string;
    name: string;
  };
}

export default function ScopesPage() {
  const { user } = useAuth();
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    slug: '',
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    slug: '',
    allowedApplications: [] as string[],
  });
  const [newAppIdentifier, setNewAppIdentifier] = useState('');
  const [appIdentifierError, setAppIdentifierError] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
        setShowCreateForm(false);
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

  const handleEditScope = (scope: Scope) => {
    setEditing(scope.id);
    setEditFormData({
      name: scope.name,
      description: scope.description,
      slug: scope.slug,
      allowedApplications: scope.allowedApplications || [],
    });
    setNewAppIdentifier('');
    setAppIdentifierError('');
  };

  const handleUpdateScope = async (e: React.FormEvent, scopeId: string) => {
    e.preventDefault();
    if (!user) return;

    try {
      const response = await fetch('/api/scopes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: scopeId,
          name: editFormData.name,
          description: editFormData.description,
          slug: editFormData.slug,
          allowedApplications:
            editFormData.allowedApplications.length === 0
              ? null
              : editFormData.allowedApplications,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setScopes(
          scopes.map(scope => (scope.id === scopeId ? data.scope : scope))
        );
        setEditing(null);
        setEditFormData({
          name: '',
          description: '',
          slug: '',
          allowedApplications: [],
        });
        setNewAppIdentifier('');
        setAppIdentifierError('');
        alert('Scope updated successfully!');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating scope:', error);
      alert('Error updating scope');
    }
  };

  const handleCancelEdit = () => {
    setEditing(null);
    setEditFormData({
      name: '',
      description: '',
      slug: '',
      allowedApplications: [],
    });
    setNewAppIdentifier('');
    setAppIdentifierError('');
  };

  const handleAddAppIdentifier = () => {
    if (!newAppIdentifier.trim()) {
      setAppIdentifierError('Please enter an application identifier');
      return;
    }

    // Basic validation: check if it's a URL or looks like a pubkey/npub
    const isUrl =
      newAppIdentifier.startsWith('http://') ||
      newAppIdentifier.startsWith('https://');
    const isNpub = newAppIdentifier.startsWith('npub1');
    const isHex = /^[0-9a-f]{64}$/i.test(newAppIdentifier);

    if (!isUrl && !isNpub && !isHex) {
      setAppIdentifierError(
        'Invalid format. Must be a URL, npub, or hex pubkey (64 chars)'
      );
      return;
    }

    // Check for duplicates
    if (editFormData.allowedApplications.includes(newAppIdentifier.trim())) {
      setAppIdentifierError('This application is already in the list');
      return;
    }

    setEditFormData({
      ...editFormData,
      allowedApplications: [
        ...editFormData.allowedApplications,
        newAppIdentifier.trim(),
      ],
    });
    setNewAppIdentifier('');
    setAppIdentifierError('');
  };

  const handleRemoveAppIdentifier = (index: number) => {
    setEditFormData({
      ...editFormData,
      allowedApplications: editFormData.allowedApplications.filter(
        (_, i) => i !== index
      ),
    });
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setFormData({ name: '', description: '', slug: '' });
  };

  const copyToClipboard = async (text: string, keyType: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyType);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const npubToHex = (npub: string) => {
    try {
      // Remove the 'npub1' prefix and decode the bech32
      const decoded = nip19.decode(npub);
      return decoded.data.toString();
    } catch (error) {
      console.error('Error converting npub to hex:', error);
      return 'Invalid npub';
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Scopes</h1>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            <span>Add New Scope</span>
          </button>
        </div>

        {/* Create Scope Form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Create New Scope
              </h2>
              <button
                onClick={handleCancelCreate}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
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
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Scope'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelCreate}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Scopes List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Your Scopes</h2>
          {scopes.length === 0 ? (
            <p className="text-gray-500">No scopes created yet.</p>
          ) : (
            scopes.map(scope => (
              <div key={scope.id} className="bg-white rounded-lg shadow p-6">
                {editing === scope.id ? (
                  // Edit Form
                  <form
                    onSubmit={e => handleUpdateScope(e, scope.id)}
                    className="space-y-4"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Edit Scope</h3>
                      <div className="space-x-2">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={editFormData.name}
                        onChange={e =>
                          setEditFormData({
                            ...editFormData,
                            name: e.target.value,
                          })
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
                        value={editFormData.description}
                        onChange={e =>
                          setEditFormData({
                            ...editFormData,
                            description: e.target.value,
                          })
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
                        value={editFormData.slug}
                        onChange={e =>
                          setEditFormData({
                            ...editFormData,
                            slug: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        placeholder="my-community-scope"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Allowed Applications
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        Restrict which applications can request connections.
                        Leave empty to allow all applications.
                      </p>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newAppIdentifier}
                            onChange={e => {
                              setNewAppIdentifier(e.target.value);
                              setAppIdentifierError('');
                            }}
                            onKeyPress={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddAppIdentifier();
                              }
                            }}
                            placeholder="https://app.example.com or npub1..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          />
                          <button
                            type="button"
                            onClick={handleAddAppIdentifier}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                          >
                            Add
                          </button>
                        </div>
                        {appIdentifierError && (
                          <p className="text-sm text-red-600">
                            {appIdentifierError}
                          </p>
                        )}
                        {editFormData.allowedApplications.length > 0 && (
                          <div className="space-y-1">
                            {editFormData.allowedApplications.map(
                              (app, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md"
                                >
                                  <span className="text-sm text-gray-800 font-mono">
                                    {app}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveAppIdentifier(index)
                                    }
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </form>
                ) : (
                  // Display Mode
                  <>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {scope.name}
                          </h3>
                          <span className="text-sm text-gray-500">
                            /{scope.slug}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(scope.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm mb-3">
                          {scope.description}
                        </p>

                        {/* Allowed Applications Display */}
                        {scope.allowedApplications &&
                        scope.allowedApplications.length > 0 ? (
                          <div className="mb-3">
                            <p className="text-xs text-gray-500 mb-1">
                              Allowed Applications (
                              {scope.allowedApplications.length})
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {scope.allowedApplications.map((app, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-mono"
                                >
                                  {app.length > 30
                                    ? `${app.substring(0, 27)}...`
                                    : app}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="mb-3">
                            <p className="text-xs text-gray-500">
                              All applications allowed
                            </p>
                          </div>
                        )}

                        {/* Compact Key Display */}
                        {scope.key && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between bg-gray-50 rounded p-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-gray-500 mb-1">
                                  Public Key (npub)
                                </div>
                                <div className="font-mono text-xs text-gray-800 break-all">
                                  {scope.key.npub}
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  copyToClipboard(
                                    scope.key?.npub || '',
                                    `npub-${scope.id}`
                                  )
                                }
                                className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                title="Copy npub"
                              >
                                {copiedKey === `npub-${scope.id}` ? (
                                  <svg
                                    className="w-4 h-4 text-green-600"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                    />
                                  </svg>
                                )}
                              </button>
                            </div>

                            <div className="flex items-center justify-between bg-gray-50 rounded p-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-gray-500 mb-1">
                                  Public Key (hex)
                                </div>
                                <div className="font-mono text-xs text-gray-800 break-all">
                                  {npubToHex(scope?.key?.npub || '')}
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  copyToClipboard(
                                    npubToHex(scope?.key?.npub || ''),
                                    `hex-${scope.id}`
                                  )
                                }
                                className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                title="Copy hex"
                              >
                                {copiedKey === `hex-${scope.id}` ? (
                                  <svg
                                    className="w-4 h-4 text-green-600"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                    />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleEditScope(scope)}
                        className="ml-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Edit scope"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
