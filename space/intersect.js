/*
Copyright (c) 2011 Nathan Ostgard http://nathanostgard.com

This software is provided 'as-is', without any express or implied
warranty.  In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
	 claim that you wrote the original software. If you use this software
	 in a product, an acknowledgment in the product documentation would be
	 appreciated but is not required.

2. Altered source versions must be plainly marked as such, and must not be
	 misrepresented as being the original software.

3. This notice may not be removed or altered from any source distribution.
*/

// Generated by CoffeeScript 1.6.3
(function() {
	var AABB, Hit, Point, Sweep, abs, clamp, epsilon, intersect, sign;

	intersect = typeof exports !== "undefined" && exports !== null 
		? exports 
		: (this.intersect != null ? this.intersect : this.intersect = {});

	intersect.epsilon = epsilon = 1e-8;

	intersect.abs = abs = function(value) {
		if (value < 0) {
			return -value;
		} else {
			return value;
		}
	};

	intersect.clamp = clamp = function(value, min, max) {
		if (value < min) {
			return min;
		} else if (value > max) {
			return max;
		} else {
			return value;
		}
	};

	intersect.sign = sign = function(value) {
		if (value < 0) {
			return -1;
		} else {
			return 1;
		}
	};

	intersect.Point = Point = (function() {
		function Point(x, y) {
			if (x == null) {
				x = 0;
			}
			if (y == null) {
				y = 0;
			}
			this.x = x;
			this.y = y;
		}

		Point.prototype.clone = function() {
			return new Point(this.x, this.y);
		};

		Point.prototype.normalize = function() {
			var inverseLength, length;
			length = this.x * this.x + this.y * this.y;
			if (length > 0) {
				length = Math.sqrt(length);
				inverseLength = 1.0 / length;
				this.x *= inverseLength;
				this.y *= inverseLength;
			}
			return length;
		};

		return Point;

	})();

	intersect.Hit = Hit = (function() {
		function Hit(collider) {
			this.collider = collider;
			this.pos = new Point();
			this.delta = new Point();
			this.normal = new Point();
		}

		return Hit;

	})();

	intersect.Sweep = Sweep = (function() {
		function Sweep() {
			this.hit = null;
			this.pos = new Point();
			this.time = 1;
		}

		return Sweep;

	})();

	intersect.AABB = AABB = (function() {
		function AABB(pos, half) {
			this.pos = pos;
			this.half = half;
		}

		AABB.prototype.intersectPoint = function(point) {
			var dx, dy, hit, px, py, sx, sy;
			dx = point.x - this.pos.x;
			px = this.half.x - abs(dx);
			if (px <= 0) {
				return null;
			}
			dy = point.y - this.pos.y;
			py = this.half.y - abs(dy);
			if (py <= 0) {
				return null;
			}
			hit = new Hit(this);
			if (px < py) {
				sx = sign(dx);
				hit.delta.x = px * sx;
				hit.normal.x = sx;
				hit.pos.x = this.pos.x + (this.half.x * sx);
				hit.pos.y = point.y;
			} else {
				sy = sign(dy);
				hit.delta.y = py * sy;
				hit.normal.y = sy;
				hit.pos.x = point.x;
				hit.pos.y = this.pos.y + (this.half.y * sy);
			}
			return hit;
		};

		AABB.prototype.intersectSegment = function(pos, delta, paddingX, paddingY) {
			var farTime, farTimeX, farTimeY, hit, nearTime, nearTimeX, nearTimeY, 
				scaleX, scaleY, signX, signY;
			if (paddingX == null) {
				paddingX = 0;
			}
			if (paddingY == null) {
				paddingY = 0;
			}
			if (Math.abs(delta.x) > intersect.epsilon && Math.abs(delta.y) > intersect.epsilon)
			{
				scaleX = 1.0 / delta.x;
				scaleY = 1.0 / delta.y;			      
				signX = sign(scaleX);
				signY = sign(scaleY);
				nearTimeX = (this.pos.x - signX * (this.half.x + paddingX) - pos.x) * scaleX;
				nearTimeY = (this.pos.y - signY * (this.half.y + paddingY) - pos.y) * scaleY;
				farTimeX = (this.pos.x + signX * (this.half.x + paddingX) - pos.x) * scaleX;
				farTimeY = (this.pos.y + signY * (this.half.y + paddingY) - pos.y) * scaleY;
				if (nearTimeX > farTimeY || nearTimeY > farTimeX) {
					return null;
				}
				nearTime = nearTimeX > nearTimeY ? nearTimeX : nearTimeY;
				farTime = farTimeX < farTimeY ? farTimeX : farTimeY;
			}
			else
			{
				if (Math.abs(delta.x) > intersect.epsilon)
				{
				scaleX = 1.0 / delta.x;
				signX = sign(scaleX);
				nearTime = (this.pos.x - signX * (this.half.x + paddingX) - pos.x) * scaleX;
				farTime = (this.pos.x + signX * (this.half.x + paddingX) - pos.x) * scaleX;
				}
				else if (Math.abs(delta.y) > intersect.epsilon)
				{
				scaleY = 1.0 / delta.y;
				signY = sign(scaleY);
				nearTime = (this.pos.y - signY * (this.half.y + paddingY) - pos.y) * scaleY;
				farTime = (this.pos.y + signY * (this.half.y + paddingY) - pos.y) * scaleY;
				}
				else
					return null;
			}
			if (nearTime >= 1 || farTime <= 0) {
				return null;
			}
			hit = new Hit(this);
			hit.time = clamp(nearTime, 0, 1);
			if (nearTimeX > nearTimeY) {
				hit.normal.x = -signX;
				hit.normal.y = 0;
			} else {
				hit.normal.x = 0;
				hit.normal.y = -signY;
			}
			hit.delta.x = hit.time * delta.x;
			hit.delta.y = hit.time * delta.y;
			hit.pos.x = pos.x + hit.delta.x;
			hit.pos.y = pos.y + hit.delta.y;
			return hit;
		};

		AABB.prototype.intersectAABB = function(box) {
			var dx, dy, hit, px, py, sx, sy;
			dx = box.pos.x - this.pos.x;
			px = (box.half.x + this.half.x) - abs(dx);
			if (px <= 0) {
				return null;
			}
			dy = box.pos.y - this.pos.y;
			py = (box.half.y + this.half.y) - abs(dy);
			if (py <= 0) {
				return null;
			}
			hit = new Hit(this);
			if (px < py) {
				sx = sign(dx);
				hit.delta.x = px * sx;
				hit.normal.x = sx;
				hit.pos.x = this.pos.x + (this.half.x * sx);
				hit.pos.y = box.pos.y;
			} else {
				sy = sign(dy);
				hit.delta.y = py * sy;
				hit.normal.y = sy;
				hit.pos.x = box.pos.x;
				hit.pos.y = this.pos.y + (this.half.y * sy);
			}
			return hit;
		};

		AABB.prototype.sweepAABB = function(box, delta) {
			var direction, sweep;
			sweep = new Sweep();
			if (delta.x === 0 && delta.y === 0) {
				sweep.pos.x = box.pos.x;
				sweep.pos.y = box.pos.y;
				sweep.hit = this.intersectAABB(box);
				if (sweep.hit != null) {
					sweep.time = sweep.hit.time = 0;
				} else {
					sweep.time = 1;
				}
			} else {
				sweep.hit = this.intersectSegment(box.pos, delta, box.half.x, box.half.y);
				if (sweep.hit != null) {
					sweep.time = clamp(sweep.hit.time - epsilon, 0, 1);
					sweep.pos.x = box.pos.x + delta.x * sweep.time;
					sweep.pos.y = box.pos.y + delta.y * sweep.time;
					direction = delta.clone();
					direction.normalize();
					sweep.hit.pos.x += direction.x * box.half.x;
					sweep.hit.pos.y += direction.y * box.half.y;
				} else {
					sweep.pos.x = box.pos.x + delta.x;
					sweep.pos.y = box.pos.y + delta.y;
					sweep.time = 1;
				}
			}
			return sweep;
		};

		AABB.prototype.sweepInto = function(staticColliders, delta) {
			var collider, nearest, sweep, _i, _len;
			nearest = new Sweep();
			nearest.time = 1;
			nearest.pos.x = this.pos.x + delta.x;
			nearest.pos.y = this.pos.y + delta.y;
			for (_i = 0, _len = staticColliders.length; _i < _len; _i++) {
				collider = staticColliders[_i];
				sweep = collider.sweepAABB(this, delta);
				if (sweep.time < nearest.time) {
					nearest = sweep;
				}
			}
			return nearest;
		};

		return AABB;

	})();

}).call(this);