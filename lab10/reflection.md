# Lab 10 — Design Reflection

I extended my Lab 9 GDP choropleth and non-contiguous cartogram with voice-controlled country selection. Commands such as “Show China” and “Highlight Japan” select the same country across both views, while “Reset” clears the selection and restores both map views. This supports locating a named economy and comparing its geographic footprint with its GDP-scaled representation without precisely clicking a small or distorted shape.

Voice input calls shared visualization functions rather than rebuilding the maps. The interface displays the recognized transcript and resulting action. A country menu, buttons, and the original map interactions provide alternatives when speech is unavailable. Listening begins only after an explicit button click, and users can cancel it.

In simulated recognition tests, unsupported phrases left the current selection unchanged, repeated commands preserved highlighting, and permission errors retained usable fallback controls. These tests validate application behavior, not real microphone accuracy. Small countries may also be difficult to see at the initial zoom level.