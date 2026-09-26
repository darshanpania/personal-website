# X Article: How Shit Works

Publish this only after the blog post is live and Google has indexed it (see the checklist in social.md).

**Title:** I Built the Chart That Cured My Fear of the Pressure Cooker

**Cover image:** public/images/posts/how-shit-works/og-cover.webp

---

_Originally published at [darshanpania.me/blog/how-shit-works](https://darshanpania.me/blog/how-shit-works/)_

As a kid, the one thing in our kitchen I stayed away from was the pressure cooker.

I grew up in a middle class family, and in a middle class home you don't open things up to see how they work. You use them, and you don't break them. So the pressure cooker stayed what it was to me: a sealed pot on the stove that whistled, and that I stayed away from.

That changed when I was 10. I got a science assignment to write about how a pressure cooker works. I read about it and made a huge chart explaining every part of it. By the time the chart was done, the fear was gone. Nothing about the cooker had changed. I just understood it now.

I forgot about that chart for a long time. Then Julie Zhuo ([@joulee](https://x.com/joulee)) brought it back.

Her post, [AI for No Good Reason](https://lg.substack.com/p/a-bird-wall-a-talking-rotary-phone), asks how we can use AI tools to get more out of leisure. She sorts the answers into four buckets: hobbies, the pot at the end of the what-if rainbow, future doses of delight, and one-of-a-kind gifts. Somewhere in that list, I was 10 again, standing next to my chart. I've always wanted to know how mechanical and electrical appliances work. What if I made that chart again, for every appliance in the house, for every kid who has the same curiosity I had?

That's [How Shit Works](https://howshitworks.darshanpania.me).

[IMAGE: landing.webp — The How Shit Works landing page with an exploded 3D cube and the appliance cards]

It's a super basic three.js static website. Each appliance is a short story, one step at a time, with the part in focus shown from the inside. Right now it has a ceiling fan, a toaster, a door knob, a door lock, and, of course, the pressure cooker. Its story ends on the safety valve, the part that opens and lets the steam out before the pot can fail. That's the answer 10-year-old me was looking for.

[IMAGE: pressure-cooker.webp — The pressure cooker page with the flame heating the water inside a sealed pot]

I built it with Opus 5.5, and that part needs some honesty.

I had literally given up on Opus 5. I hated that model. It did nothing productive. It just vomited tons of garbage Claude-ish, English but by Claude, that made no sense, and I had to sit there and decipher it. It made me very angry.

Opus 5.5 is everything Opus 5 promised to be, and even better. My prompt for How Shit Works was simple: research 3D models, and wow me. It did. It came back with 3D models, animations, and sounds. Opus 5 would never have built 3D models this well. Opus 5.5 has been a breath of fresh air.

[IMAGE: toaster.webp — The toaster in x-ray view with the heating elements glowing red]

Before launch, I showed it to a friend. He loved the design and the animations. He also looked past them. At that point, every appliance had its own code, and his feedback was to build a framework that every appliance could reuse. That became the studio redesign. Now the code is modular, and adding a new appliance is easy. That matters, because the coming soon list already has a lot more appliances and tools waiting on it.

[IMAGE: door-lock.webp — The door lock page showing five pin tumblers lined up at the shear line]

I built this for kids and adults alike, so I have two asks.

Share [How Shit Works](https://howshitworks.darshanpania.me) with your kids and young ones, and let their curiosity be satiated. Somewhere, a kid is scared of the pressure cooker in their kitchen.

And build something for fun. Pick one of Julie's buckets and make something for no good reason. Mine started as a chart I made when I was 10.

---

_This piece first appeared on my blog: [darshanpania.me/blog/how-shit-works](https://darshanpania.me/blog/how-shit-works/)_
