export const COLOR_CLASSES = [
  "uc-aqua",
  "uc-black",
  "uc-blue",
  "uc-fuchsia",
  "uc-gray",
  "uc-green",
  "uc-lime",
  "uc-maroon",
  "uc-navy",
  "uc-olive",
  "uc-purple",
  "uc-red",
  "uc-silver",
  "uc-teal",
  "uc-white",
  "uc-yellow",
];

export function usernameColorClass(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash += username.charCodeAt(i);
  }
  return COLOR_CLASSES[hash % COLOR_CLASSES.length];
}
