use std::collections::HashMap;
use std::time::{Duration, SystemTime};

#[derive(Clone)]
pub struct CacheEntry {
    pub value: String,
    pub expires_at: SystemTime,
}

pub struct TtlCache {
    store: HashMap<String, CacheEntry>,
}

impl TtlCache {
    pub fn new() -> Self {
        Self { store: HashMap::new() }
    }

    pub fn insert(&mut self, key: String, value: String, ttl: Duration) {
        let expires_at = SystemTime::now() + ttl;
        self.store.insert(key, CacheEntry { value, expires_at });
    }

    pub fn get(&mut self, key: &str) -> Option<String> {
        if let Some(entry) = self.store.get(key) {
            if SystemTime::now() <= entry.expires_at {
                return Some(entry.value.clone());
            }
        }
        self.store.remove(key);
        None
    }

    pub fn purge_expired(&mut self) -> usize {
        let before = self.store.len();
        self.store.retain(|_, entry| SystemTime::now() <= entry.expires_at);
        before - self.store.len()
    }
}
