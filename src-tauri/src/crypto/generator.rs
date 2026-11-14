//! Cryptographically secure password and diceware passphrase generator.
//!
//! Uses `rand::rngs::OsRng` / `thread_rng` (CSPRNG) to generate high-entropy
//! passwords and passphrases matching Bitwarden's generator options.

use rand::{seq::SliceRandom, Rng};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

const UPPERCASE_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const UPPERCASE_NO_AMBIGUOUS: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE_CHARS: &[u8] = b"abcdefghijklmnopqrstuvwxyz";
const LOWERCASE_NO_AMBIGUOUS: &[u8] = b"abcdefghijkmnopqrstuvwxyz";
const NUMBER_CHARS: &[u8] = b"0123456789";
const NUMBER_NO_AMBIGUOUS: &[u8] = b"23456789";
const SYMBOL_CHARS: &[u8] = b"!@#$%^&*";

/// Curated EFF-style diceware wordlist for memorable, high-entropy passphrases.
const WORDLIST: &[&str] = &[
    "abacus", "abdomen", "ability", "ablaze", "abnormal", "abrasion", "abruptly", "absence",
    "absorber", "abstract", "absurdly", "academic", "accented", "acclaim", "account", "accuracy",
    "accurate", "accustom", "acoustic", "acquaint", "acquire", "acrobat", "acronym", "acting",
    "activate", "activism", "activist", "activity", "actress", "actually", "adaptor", "addition",
    "adeptly", "adhesion", "adjacent", "adjoining", "admiral", "admired", "adopter", "adoption",
    "adorable", "adorned", "adrift", "adult", "advance", "advent", "adverse", "advised",
    "advocate", "aerial", "affable", "affair", "affected", "affluent", "afford", "affront",
    "afield", "afloat", "afraid", "afterglow", "against", "agency", "agenda", "ageless",
    "agile", "agitate", "agnostic", "agonize", "agreed", "airborne", "aircraft", "airfield",
    "airline", "airlock", "airplane", "airport", "airtight", "alabaster", "alarmed", "albatross",
    "alchemy", "alcove", "alderman", "algebra", "algorithm", "alias", "alibi", "alienate",
    "aligned", "alkaline", "allergy", "alliance", "alligator", "allocate", "allotment", "allowable",
    "alloy", "alluring", "ally", "almanac", "almighty", "almond", "almost", "aloe",
    "aloft", "aloha", "alone", "alongside", "aloof", "alphabet", "alpine", "already",
    "altitude", "alto", "altruism", "aluminum", "alumni", "always", "amaretto", "amaze",
    "amber", "ambiance", "ambiguity", "ambition", "amble", "ambush", "amendable", "amenity",
    "amiable", "amicably", "amid", "amigo", "amino", "amiss", "ammonia", "amnesty",
    "amniotic", "among", "amount", "amperage", "ample", "amplifier", "amplify", "amply",
    "amuck", "amulet", "amusable", "amused", "amusement", "amuser", "amusing", "anaconda",
    "anaerobic", "anagram", "anatomist", "anatomy", "anchor", "anchovy", "ancient", "android",
    "anemia", "anemic", "aneurism", "anew", "angelic", "angered", "angled", "angler",
    "angles", "angling", "angrily", "angriness", "anguished", "angular", "animal", "animate",
    "animating", "animation", "animator", "anime", "animosity", "ankle", "annex", "annotate",
    "announcer", "annoying", "annually", "annuity", "anointer", "another", "answering", "antacid",
    "antarctic", "anteater", "antelope", "antenna", "anthem", "anthill", "anthology", "antibody",
    "antics", "antidote", "antihero", "antiquely", "antiques", "antiquity", "antirust", "antitoxic",
    "antitrust", "antiviral", "antler", "antonym", "antsy", "anvil", "anybody", "anyhow",
    "anymore", "anyone", "anyplace", "anything", "anytime", "anyway", "anywhere", "aorta",
    "apache", "apostle", "appealing", "appear", "appease", "appendage", "appendix", "appetite",
    "appetizer", "applaud", "applause", "apple", "appliance", "applicant", "applied", "apply",
    "appointee", "appraisal", "appraiser", "apprehend", "approach", "approval", "approve", "apricot",
    "april", "apron", "aptitude", "aptly", "aqua", "aqueduct", "arbitrary", "arbitrate",
    "ardently", "area", "arena", "arguable", "arguably", "argue", "arise", "armadillo",
    "armband", "armchair", "armed", "armful", "armhole", "arming", "armless", "armoire",
    "armored", "armory", "armrest", "army", "aroma", "arose", "around", "arousal",
];

/// Configuration options for password generation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordGeneratorOptions {
    /// Length of the generated password (`5`..=`128`).
    pub length: usize,
    /// Include uppercase ASCII letters (`A-Z`).
    pub uppercase: bool,
    /// Include lowercase ASCII letters (`a-z`).
    pub lowercase: bool,
    /// Include numeric digits (`0-9`).
    pub numbers: bool,
    /// Include special symbols (`!@#$%^&*`).
    pub symbols: bool,
    /// Minimum number of numeric digits required.
    pub min_numbers: usize,
    /// Minimum number of special symbols required.
    pub min_symbols: usize,
    /// Exclude visually ambiguous characters (`I`, `l`, `1`, `O`, `0`).
    pub avoid_ambiguous: bool,
}

impl Default for PasswordGeneratorOptions {
    fn default() -> Self {
        Self {
            length: 16,
            uppercase: true,
            lowercase: true,
            numbers: true,
            symbols: true,
            min_numbers: 1,
            min_symbols: 1,
            avoid_ambiguous: false,
        }
    }
}

/// Configuration options for diceware passphrase generation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PassphraseGeneratorOptions {
    /// Number of words (`3`..=`20`).
    pub num_words: usize,
    /// Delimiter placed between words (default `"-"`).
    pub word_separator: String,
    /// Capitalize the first letter of each word.
    pub capitalize: bool,
    /// Append a random numeric digit to one of the words.
    pub include_number: bool,
}

impl Default for PassphraseGeneratorOptions {
    fn default() -> Self {
        Self {
            num_words: 4,
            word_separator: "-".to_string(),
            capitalize: false,
            include_number: false,
        }
    }
}

/// Generates a random password satisfying all character set and minimum count constraints.
pub fn generate_password(opts: &PasswordGeneratorOptions) -> Result<String, AppError> {
    if !opts.uppercase && !opts.lowercase && !opts.numbers && !opts.symbols {
        return Err(AppError::Validation(
            "At least one character set must be enabled".into(),
        ));
    }

    let length = opts.length.clamp(5, 128);
    let mut rng = rand::thread_rng();
    let mut result: Vec<u8> = Vec::with_capacity(length);
    let mut pool: Vec<u8> = Vec::new();

    let upper_set = if opts.avoid_ambiguous {
        UPPERCASE_NO_AMBIGUOUS
    } else {
        UPPERCASE_CHARS
    };
    let lower_set = if opts.avoid_ambiguous {
        LOWERCASE_NO_AMBIGUOUS
    } else {
        LOWERCASE_CHARS
    };
    let number_set = if opts.avoid_ambiguous {
        NUMBER_NO_AMBIGUOUS
    } else {
        NUMBER_CHARS
    };

    if opts.uppercase {
        pool.extend_from_slice(upper_set);
        if let Some(&c) = upper_set.choose(&mut rng) {
            result.push(c);
        }
    }
    if opts.lowercase {
        pool.extend_from_slice(lower_set);
        if let Some(&c) = lower_set.choose(&mut rng) {
            result.push(c);
        }
    }
    if opts.numbers {
        pool.extend_from_slice(number_set);
        let min_num = opts.min_numbers.max(1);
        for _ in 0..min_num {
            if result.len() < length {
                if let Some(&c) = number_set.choose(&mut rng) {
                    result.push(c);
                }
            }
        }
    }
    if opts.symbols {
        pool.extend_from_slice(SYMBOL_CHARS);
        let min_sym = opts.min_symbols.max(1);
        for _ in 0..min_sym {
            if result.len() < length {
                if let Some(&c) = SYMBOL_CHARS.choose(&mut rng) {
                    result.push(c);
                }
            }
        }
    }

    while result.len() < length {
        if let Some(&c) = pool.choose(&mut rng) {
            result.push(c);
        }
    }

    result.truncate(length);
    result.shuffle(&mut rng);

    String::from_utf8(result)
        .map_err(|e| AppError::Internal(format!("Generated password encoding error: {e}")))
}

/// Generates a diceware passphrase according to [`PassphraseGeneratorOptions`].
pub fn generate_passphrase(opts: &PassphraseGeneratorOptions) -> Result<String, AppError> {
    let num_words = opts.num_words.clamp(3, 20);
    let mut rng = rand::thread_rng();
    let mut words: Vec<String> = Vec::with_capacity(num_words);

    for _ in 0..num_words {
        let raw_word = WORDLIST
            .choose(&mut rng)
            .copied()
            .unwrap_or("security");
        let formatted = if opts.capitalize {
            let mut chars = raw_word.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        } else {
            raw_word.to_string()
        };
        words.push(formatted);
    }

    if opts.include_number && !words.is_empty() {
        let idx = rng.gen_range(0..words.len());
        let digit = rng.gen_range(0..=9);
        words[idx].push_str(&digit.to_string());
    }

    Ok(words.join(&opts.word_separator))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_password_should_respect_length_and_character_constraints() {
        let opts = PasswordGeneratorOptions {
            length: 24,
            uppercase: true,
            lowercase: true,
            numbers: true,
            symbols: true,
            min_numbers: 3,
            min_symbols: 3,
            avoid_ambiguous: true,
        };
        let pwd = generate_password(&opts).unwrap();
        assert_eq!(pwd.len(), 24);
        assert!(pwd.chars().filter(|c| c.is_ascii_digit()).count() >= 3);
        assert!(!pwd.contains('0') && !pwd.contains('O') && !pwd.contains('l'));
    }

    #[test]
    fn generate_passphrase_should_respect_word_count_and_capitalization() {
        let opts = PassphraseGeneratorOptions {
            num_words: 5,
            word_separator: "-".to_string(),
            capitalize: true,
            include_number: true,
        };
        let phrase = generate_passphrase(&opts).unwrap();
        let parts: Vec<&str> = phrase.split('-').collect();
        assert_eq!(parts.len(), 5);
        assert!(phrase.chars().any(|c| c.is_ascii_digit()));
    }
}
