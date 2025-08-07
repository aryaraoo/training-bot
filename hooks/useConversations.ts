import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export function useConversations() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)

  const fetchConversations = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const response = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
      console.log('Supabase response:', response)
      if (response.error) throw response.error
      setConversations(response.data as Conversation[] || [])
    } catch (error) {
      console.error('Error fetching conversations:', JSON.stringify(error, null, 2))
      setConversations([])
    } finally {
      setLoading(false)
    }
  }, [user])

  const createConversation = useCallback(
    async (title: string) => {
      if (!user) return null;

      try {
        const { data, error } = await supabase
          .from('conversations')
          .insert({ user_id: user.id, title })
          .select()
          .single();

        if (error) {
          console.error('Supabase insert error:', error);
          throw error;
        }

        const conversation = data as Conversation;

        // Assuming setConversations(...) is available in scope:
        setConversations((prev) => [conversation, ...prev]);

        return conversation;
      } catch (error) {
        console.error('Error creating conversation:', error);
        return null;
      }
    },
    [user, setConversations]
  );

  const updateConversationTitle = useCallback(async (conversationId: string, title: string) => {
    if (!user) return
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ title })
        .eq('id', conversationId)
        .eq('user_id', user.id)
      if (error) throw error
      setConversations(prev =>
        prev.map(conv =>
          conv.id === conversationId ? { ...conv, title } : conv
        )
      )
    } catch (error) {
      console.error('Error updating conversation:', error)
    }
  }, [user])

  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!user) return
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', user.id)
      if (error) throw error
      setConversations(prev => prev.filter(conv => conv.id !== conversationId))
    } catch (error) {
      console.error('Error deleting conversation:', error)
    }
  }, [user])

  const getMessages = useCallback(async (conversationId: string): Promise<Message[]> => {
    if (!user) return []
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Message[] || []
    } catch (error) {
      console.error('Error fetching messages:', error)
      return []
    }
  }, [user])

  const saveMessage = useCallback(
    async (conversationId: string, role: 'user' | 'assistant', content: string) => {
      if (!user) return null
      try {
        const { data, error } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            role,
            content,
          })
          .select()
          .single()
        if (error) throw error
        // Update conversation's updated_at timestamp (not awaited)
        supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId)
          .eq('user_id', user.id)
        return data as Message
      } catch (error) {
        console.error('Error saving message:', error)
        return null
      }
    },
    [user]
  )

  useEffect(() => {
    if (user) {
      fetchConversations()
    } else {
      setConversations([])
    }
  }, [user, fetchConversations])

  return {
    conversations,
    loading,
    createConversation,
    updateConversationTitle,
    deleteConversation,
    getMessages,
    saveMessage,
    refetch: fetchConversations,
  }
}
