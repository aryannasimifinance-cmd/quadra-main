<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

/** مربی */
class Coach extends Authenticatable
{
    use HasApiTokens;

    protected $table = 'coaches';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $guarded = [];
    protected $hidden = ['password'];

    public function role(): string
    {
        return 'coach';
    }
}